using System.IO;
using System.Text;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;

namespace NetCruncher.Services
{
    public interface IFileService
    {
        Task<string> ProcessFileAsync(IFormFile file);
    }

    public class FileService : IFileService
    {
        public async Task<string> ProcessFileAsync(IFormFile file)
        {
            // Simple logic for counting words in a text file
            using (var reader = new StreamReader(file.OpenReadStream(), Encoding.UTF8))
            {
                var content = await reader.ReadToEndAsync();
                var wordCount = content.Split(new[] { ' ', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries).Length;
                return $"File contains {wordCount} words.";
            }
        }
    }
}
