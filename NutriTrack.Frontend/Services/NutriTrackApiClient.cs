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

    public async Task<(bool ok, string? error)> SaveMealAsync(MealRequest req)
    {
        var client = _factory.CreateClient("NutriTrackApi");
        var json = JsonSerializer.Serialize(req, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        var res = await client.PostAsync("/meals", new StringContent(json, Encoding.UTF8, "application/json"));
        var body = await res.Content.ReadAsStringAsync();

        return res.IsSuccessStatusCode ? (true, null) : (false, body);
    }
}
