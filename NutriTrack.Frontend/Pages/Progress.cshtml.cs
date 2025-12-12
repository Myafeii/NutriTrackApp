using Microsoft.AspNetCore.Mvc.RazorPages;
using NutriTrack.Frontend.Models;
using NutriTrack.Frontend.Services;

namespace NutriTrack.Frontend.Pages;

public class ProgressModel : PageModel
{
    public int DailyGoal { get; set; } = 2000;
    public double TodayTotal { get; set; }
    public int TodayPercent { get; set; }

    public List<(DateTime Date, double Total)> Weekly { get; set; } = new();

    public void OnGet()
    {
        var meals = HttpContext.Session.GetObject<List<MealItem>>("meals") ?? new List<MealItem>();

        var today = DateTime.Today;
        TodayTotal = meals.Where(m => m.CreatedAt.Date == today).Sum(m => m.Calories);
        TodayPercent = (int)Math.Min(100, Math.Round((TodayTotal / DailyGoal) * 100));

        var start = today.AddDays(-6);

        Weekly = Enumerable.Range(0, 7)
            .Select(i =>
            {
                var date = start.AddDays(i);
                var total = meals.Where(m => m.CreatedAt.Date == date).Sum(m => m.Calories);
                return (date, total);
            })
            .ToList();
    }
}
