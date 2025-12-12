using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using NutriTrack.Frontend.Models;
using NutriTrack.Frontend.Services;

namespace NutriTrack.Frontend.Pages.Account;

public class RegisterModel : PageModel
{
    private readonly NutriTrackApiClient _api;
    public RegisterModel(NutriTrackApiClient api) => _api = api;

    [BindProperty] public string Name { get; set; } = "";
    [BindProperty] public string Email { get; set; } = "";
    [BindProperty] public string Password { get; set; } = "";

    public string? Error { get; set; }

    public void OnGet()
    {
        var uid = HttpContext.Session.GetString("uid");
        if (!string.IsNullOrEmpty(uid))
        {
            Response.Redirect("/");
        }
    }

    public async Task<IActionResult> OnPostAsync()
    {
        var (ok, uid, err) = await _api.RegisterAsync(new RegisterRequest
        {
            Name = Name,
            Email = Email,
            Password = Password
        });

        if (!ok || string.IsNullOrEmpty(uid))
        {
            Error = err ?? "Registration failed.";
            return Page();
        }

        HttpContext.Session.SetString("uid", uid);
        return RedirectToPage("/Index");
    }
}
