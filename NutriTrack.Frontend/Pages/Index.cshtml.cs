using Microsoft.AspNetCore.Mvc.RazorPages;
using NutriTrack.Frontend.Models;
using NutriTrack.Frontend.Services;

namespace NutriTrack.Frontend.Pages;

public class IndexModel : PageModel
{
    public string Uid { get; set; } = "";
    public List<MealItem> Meals { get; set; } = new();
    public double TodayTotal { get; set; }
    public int DailyGoal { get; set; } = 2000;

    public void OnGet()
    {
        Uid = HttpContext.Session.GetString("uid") ?? "";
        Meals = HttpContext.Session.GetObject<List<MealItem>>("meals") ?? new List<MealItem>();

        var today = DateTime.Today;
        TodayTotal = Meals.Where(m => m.CreatedAt.Date == today).Sum(m => m.Calories);
    }
}
