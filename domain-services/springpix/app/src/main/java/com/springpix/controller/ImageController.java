package com.springpix.controller;

import com.springpix.service.ImageService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/images")
public class ImageController {

    private final ImageService imageService;

    @Autowired
    public ImageController(ImageService imageService) {
        this.imageService = imageService;
    }

    @PostMapping("/upload")
    public String uploadImage(@RequestParam("file") MultipartFile file) {
        try {
            String imageUrl = imageService.uploadImage(file);
            return "Image uploaded successfully! URL: " + imageUrl;
        } catch (Exception e) {
            e.printStackTrace();
            return "Failed to upload image: " + e.getMessage();
        }
    }

    @GetMapping("/status/{imageId}")
    public String checkImageStatus(@PathVariable String imageId) {
        return imageService.getImageStatus(imageId);
    }
}
