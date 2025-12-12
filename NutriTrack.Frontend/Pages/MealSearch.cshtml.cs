using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using NutriTrack.Frontend.Models;
using NutriTrack.Frontend.Services;
using System.Text.Json;

namespace NutriTrack.Frontend.Pages;

public class MealSearchModel : PageModel
{
    private readonly NutriTrackApiClient _api;
    public MealSearchModel(NutriTrackApiClient api) => _api = api;

    [BindProperty] public string Query { get; set; } = "";
    public string? Message { get; set; }

    public List<ResultItem> Results { get; set; } = new();

    public class ResultItem
    {
        public string Description { get; set; } = "";
        public double Calories { get; set; }
    }

    public void OnGet() { }

    public async Task<IActionResult> OnPostSearchAsync()
    {
        using var doc = await _api.SearchNutritionAsync(Query);
        if (doc == null)
        {
            Message = "Nutrition search failed (backend/USDA).";
            return Page();
        }

        if (!doc.RootElement.TryGetProperty("foods", out var foods) || foods.ValueKind != JsonValueKind.Array)
        {
            Message = "No foods found.";
            return Page();
        }

        Results = foods.EnumerateArray()
            .Take(10)
            .Select(f => new ResultItem
            {
                Description = f.TryGetProperty("description", out var d) ? d.GetString() ?? "Food" : "Food",
                Calories = TryGetCalories(f)
            })
            .ToList();

        if (Results.Count == 0) Message = "No results.";
        return Page();
    }

    public async Task<IActionResult> OnPostAddAsync(string food, double calories)
    {
        var uid = HttpContext.Session.GetString("uid") ?? "";
        if (string.IsNullOrEmpty(uid)) return RedirectToPage("/Account/Login");

        var (ok, err) = await _api.SaveMealAsync(new MealRequest
        {
            Uid = uid,
            Food = food,
            Calories = calories
        });

        if (!ok)
        {
            Message = "Save failed: " + err;
            return Page();
        }

        var meals = HttpContext.Session.GetObject<List<MealItem>>("meals") ?? new List<MealItem>();
        meals.Add(new MealItem { Food = food, Calories = calories, CreatedAt = DateTime.Now });
        HttpContext.Session.SetObject("meals", meals);

        return RedirectToPage("/Index");
    }

    private static double TryGetCalories(JsonElement food)
    {
        if (!food.TryGetProperty("foodNutrients", out var nutrients) || nutrients.ValueKind != JsonValueKind.Array)
            return 0;

        foreach (var n in nutrients.EnumerateArray())
        {
            var name = n.TryGetProperty("nutrientName", out var nn) ? (nn.GetString() ?? "") : "";
            var unit = n.TryGetProperty("unitName", out var un) ? (un.GetString() ?? "") : "";

            if (name.Contains("Energy", StringComparison.OrdinalIgnoreCase) &&
                unit.Contains("KCAL", StringComparison.OrdinalIgnoreCase))
            {
                if (n.TryGetProperty("value", out var v) && v.TryGetDouble(out var cal))
                    return cal;
            }
        }
        return 0;
    }
}
