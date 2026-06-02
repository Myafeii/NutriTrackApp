using System.Text;
using System.Text.Json;
using NutriTrack.Frontend.Models;

namespace NutriTrack.Frontend.Services;

public class NutriTrackApiClient
{
    private readonly IHttpClientFactory _factory;
    public NutriTrackApiClient(IHttpClientFactory factory) => _factory = factory;

    public async Task<(bool ok, string? uid, string? error)> RegisterAsync(RegisterRequest req)
    {
        var client = _factory.CreateClient("NutriTrackApi");
        var json = JsonSerializer.Serialize(req, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        var res = await client.PostAsync("/register", new StringContent(json, Encoding.UTF8, "application/json"));
        var body = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode) return (false, null, body);

        using var doc = JsonDocument.Parse(body);
        var uid = doc.RootElement.GetProperty("uid").GetString();
        return (true, uid, null);
    }

    public async Task<JsonDocument?> SearchNutritionAsync(string query)
    {
        var client = _factory.CreateClient("NutriTrackApi");
        var res = await client.GetAsync($"/nutrition/{Uri.EscapeDataString(query)}");
        if (!res.IsSuccessStatusCode) return null;

        var body = await res.Content.ReadAsStringAsync();
        return JsonDocument.Parse(body);
    }

    public async Task<(bool ok, string? mealId, string? error)> SaveMealAsync(MealRequest req)
    {
        var client = _factory.CreateClient("NutriTrackApi");
        var json = JsonSerializer.Serialize(req, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        var res = await client.PostAsync("/meals", new StringContent(json, Encoding.UTF8, "application/json"));
        var body = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode) return (false, null, body);

        using var doc = JsonDocument.Parse(body);
        var id = doc.RootElement.TryGetProperty("id", out var idProp) ? idProp.GetString() : null;

        return (true, id, null);
    }

    public async Task<(bool ok, List<MealItem> meals, string? error)> GetMealsAsync(string uid)
    {
        var client = _factory.CreateClient("NutriTrackApi");
        var res = await client.GetAsync($"/meals?uid={Uri.EscapeDataString(uid)}");
        var body = await res.Content.ReadAsStringAsync();

        if (!res.IsSuccessStatusCode) return (false, new List<MealItem>(), body);

        using var doc = JsonDocument.Parse(body);
        var meals = new List<MealItem>();

        if (!doc.RootElement.TryGetProperty("meals", out var mealsEl) || mealsEl.ValueKind != JsonValueKind.Array)
            return (true, meals, null);

        foreach (var m in mealsEl.EnumerateArray())
        {
            var id = m.TryGetProperty("id", out var idp) ? idp.GetString() : null;
            var food = m.TryGetProperty("food", out var fp) ? fp.GetString() ?? "" : "";
            var calories = m.TryGetProperty("calories", out var cp) && cp.TryGetDouble(out var cal) ? cal : 0;

            
            DateTime createdAt = DateTime.Now;
            if (m.TryGetProperty("createdAt", out var ca))
            {
                if (ca.ValueKind == JsonValueKind.String && DateTime.TryParse(ca.GetString(), out var dt))
                    createdAt = dt;
                else if (ca.ValueKind == JsonValueKind.Object && ca.TryGetProperty("_seconds", out var sec) && sec.TryGetInt64(out var s))
                    createdAt = DateTimeOffset.FromUnixTimeSeconds(s).LocalDateTime;
            }

            meals.Add(new MealItem { Id = id, Food = food, Calories = calories, CreatedAt = createdAt });
        }

        return (true, meals, null);
    }

    public async Task<(bool ok, string? error)> DeleteMealAsync(string mealId, string uid)
    {
        var client = _factory.CreateClient("NutriTrackApi");
        var url = $"/meals/{Uri.EscapeDataString(mealId)}?uid={Uri.EscapeDataString(uid)}";

        var res = await client.DeleteAsync(url);
        var body = await res.Content.ReadAsStringAsync();
        return res.IsSuccessStatusCode ? (true, null) : (false, body);
    }

    public async Task<(bool ok, string? error)> ResetPasswordAsync(string email)
    {
        var client = _factory.CreateClient("NutriTrackApi");
        var payload = JsonSerializer.Serialize(new { email }, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        var res = await client.PostAsync("/reset-password", new StringContent(payload, Encoding.UTF8, "application/json"));
        var body = await res.Content.ReadAsStringAsync();
        return res.IsSuccessStatusCode ? (true, null) : (false, body);
    }
}
