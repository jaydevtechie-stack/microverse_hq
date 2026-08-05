using Microsoft.AspNetCore.Mvc;
using NetCruncher.Services;
using System.Threading.Tasks;

namespace NetCruncher.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FileProcessorController : ControllerBase
    {
        private readonly IFileService _fileService;

        public FileProcessorController(IFileService fileService)
        {
            _fileService = fileService;
        }

        [HttpPost("upload")]
        public async Task<IActionResult> UploadFile(IFormFile file)
        {
            if (file == null)
            {
                return BadRequest("No file uploaded.");
            }

            var result = await _fileService.ProcessFileAsync(file);
            return Ok(result);
        }
    }
}
