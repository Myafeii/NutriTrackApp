using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace NutriTrack.Frontend.Pages.Account;

public class LoginModel : PageModel
{
    [BindProperty] public string Uid { get; set; } = "";
    public string? Error { get; set; }

    public void OnGet()
    {
        // If already logged in, go dashboard
        var uid = HttpContext.Session.GetString("uid");
        if (!string.IsNullOrEmpty(uid))
        {
            Response.Redirect("/");
        }
    }

    public IActionResult OnPost()
    {
        if (string.IsNullOrWhiteSpace(Uid))
        {
            Error = "UID is required.";
            return Page();
        }

        HttpContext.Session.SetString("uid", Uid.Trim());
        return RedirectToPage("/Index");
    }
}
