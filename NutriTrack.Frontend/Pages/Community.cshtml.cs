using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using NutriTrack.Frontend.Models;
using NutriTrack.Frontend.Services;

namespace NutriTrack.Frontend.Pages;

public class CommunityModel : PageModel
{
    [BindProperty] public string NewPost { get; set; } = "";

    public List<PostItem> Posts { get; set; } = new();

    public void OnGet()
    {
        Posts = HttpContext.Session.GetObject<List<PostItem>>("posts") ?? new List<PostItem>();
    }

    public IActionResult OnPost()
    {
        var posts = HttpContext.Session.GetObject<List<PostItem>>("posts") ?? new List<PostItem>();

        posts.Add(new PostItem
        {
            Text = NewPost.Trim(),
            CreatedAt = DateTime.Now
        });

        HttpContext.Session.SetObject("posts", posts);
        return RedirectToPage("/Community");
    }
}
