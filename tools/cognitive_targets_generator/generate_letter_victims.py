#!/usr/bin/env python3
"""
Generate Letter Victim images for RoboCup Junior Rescue Maze 2026.

Specifications:
- Characters: Φ (Harmed), Ψ (Stable), Ω (Unharmed)
- Color: Black
- Typeface: Sans-serif (Arial)
- Height: 4 cm
"""

import os
from PIL import Image, ImageDraw, ImageFont

# DPI for converting cm to pixels (300 DPI for high-quality print)
DPI = 300

# Victim definitions
VICTIMS = {
    'harmed': {'char': '\u03A6', 'name': 'Phi'},
    'stable': {'char': '\u03A8', 'name': 'Psi'},
    'unharmed': {'char': '\u03A9', 'name': 'Omega'}
}

def cm_to_pixels(cm):
    """Convert centimeters to pixels based on DPI."""
    return int(cm * DPI / 2.54)

def find_font():
    """Find a suitable sans-serif font on the system."""
    # Common paths for Arial on macOS
    font_paths = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Microsoft/Arial.ttf"
    ]
    
    for path in font_paths:
        if os.path.exists(path):
            return path
    
    # Fallback to a default font if possible, though it might not be Arial
    return None

def create_letter_victim(char, target_height_cm, font_path, output_path):
    """
    Create a letter victim image.
    
    Args:
        char: The character to draw (e.g., 'Φ')
        target_height_cm: Target height in cm (4 cm)
        font_path: Path to the .ttf font file
        output_path: Path to save the PNG
    """
    target_height_px = cm_to_pixels(target_height_cm)
    
    # We need to find the font size that results in the character itself being 4cm high.
    # We'll use a large font size first and scale based on measured height.
    initial_font_size = 500
    if font_path:
        font = ImageFont.truetype(font_path, initial_font_size)
    else:
        # If no font found, Pillow will use its default which is very small.
        # This is a fallback that might not look correct but prevents crashing.
        print("Warning: Arial font not found. Using default font.")
        font = ImageFont.load_default()
        
    # Get text bounding box to measure actual height of the character
    # Use a temporary image for measurement
    temp_img = Image.new('RGBA', (initial_font_size * 2, initial_font_size * 2), (0, 0, 0, 0))
    temp_draw = ImageDraw.Draw(temp_img)
    
    # getbbox returns (left, top, right, bottom)
    bbox = temp_draw.textbbox((0, 0), char, font=font)
    char_height = bbox[3] - bbox[1]
    
    # Adjust font size to match target height exactly
    adjusted_font_size = int(initial_font_size * (target_height_px / char_height))
    font = ImageFont.truetype(font_path, adjusted_font_size) if font_path else ImageFont.load_default()
    
    # Re-measure with adjusted font size
    bbox = temp_draw.textbbox((0, 0), char, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    
    # Add some padding (10% of height) to ensure no clipping
    padding = int(height * 0.1)
    img_w = width + (padding * 2)
    img_h = height + (padding * 2)
    
    # Create final image
    img = Image.new('RGBA', (img_w, img_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # Draw character centered
    # We subtract bbox[0] and bbox[1] to align the character properly starting from its top-left ink
    draw.text((padding - bbox[0], padding - bbox[1]), char, fill=(0, 0, 0, 255), font=font)
    
    # Save image
    img.save(output_path)
    print(f"Generated: {output_path} (Size: {img_w}x{img_h}px, Char Height: {height}px)")

def main():
    output_dir = os.path.join(os.path.dirname(__file__), 'output', 'letters')
    os.makedirs(output_dir, exist_ok=True)
    
    font_path = find_font()
    if not font_path:
        print("Error: Could not find Arial or a suitable sans-serif font.")
        # We'll try to continue with default, but it won't be Arial.
    
    target_height = 4.0  # cm
    
    for key, info in VICTIMS.items():
        filename = f"letter_victim_{key}.png"
        filepath = os.path.join(output_dir, filename)
        create_letter_victim(info['char'], target_height, font_path, filepath)

if __name__ == "__main__":
    main()
