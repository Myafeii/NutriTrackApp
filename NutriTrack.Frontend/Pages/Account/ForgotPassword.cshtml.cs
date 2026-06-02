using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using NutriTrack.Frontend.Services;

namespace NutriTrack.Frontend.Pages.Account;

public class ForgotPasswordModel : PageModel
{
    private readonly NutriTrackApiClient _api;
    public ForgotPasswordModel(NutriTrackApiClient api) => _api = api;

    [BindProperty] public string Email { get; set; } = "";
    public string? Message { get; set; }

    public void OnGet() { }

    public async Task<IActionResult> OnPostAsync()
    {
        var (ok, err) = await _api.ResetPasswordAsync(Email);
        Message = ok ? "Reset email sent! Check your inbox/spam." : ("Failed: " + err);
        return Page();
    }
}