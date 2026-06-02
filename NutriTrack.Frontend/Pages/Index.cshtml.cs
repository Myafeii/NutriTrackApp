using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using NutriTrack.Frontend.Models;
using NutriTrack.Frontend.Services;

namespace NutriTrack.Frontend.Pages;

public class IndexModel : PageModel
{
    private readonly NutriTrackApiClient _api;
    public IndexModel(NutriTrackApiClient api) => _api = api;

    public string Uid { get; set; } = "";
    public string UserName { get; set; } = "";

    public List<MealItem> Meals { get; set; } = new();
    public double TodayTotal { get; set; }
    public int DailyGoal { get; set; } = 2000;

    public async Task OnGetAsync()
    {
        Uid = HttpContext.Session.GetString("uid") ?? "";
        UserName = HttpContext.Session.GetString("name") ?? "User";

        if (!string.IsNullOrEmpty(Uid))
        {
            var (ok, meals, err) = await _api.GetMealsAsync(Uid);
            if (ok)
            {
                Meals = meals;
                HttpContext.Session.SetObject("meals", Meals); 
            }
        }

        var today = DateTime.Today;
        TodayTotal = Meals.Where(m => m.CreatedAt.Date == today).Sum(m => m.Calories);
    }

    public async Task<IActionResult> OnPostDeleteAsync(string mealId)
    {
        var uid = HttpContext.Session.GetString("uid") ?? "";
        if (string.IsNullOrEmpty(uid)) return RedirectToPage("/Account/Login");

        if (!string.IsNullOrWhiteSpace(mealId))
            await _api.DeleteMealAsync(mealId, uid);

        return RedirectToPage("/Index");
    }
}