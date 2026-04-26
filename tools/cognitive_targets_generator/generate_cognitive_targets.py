#!/usr/bin/env python3
"""
Generate cognitive target images with concentric rings.

Each target has up to 5 concentric rings with diameters of 1, 2, 3, 4, 5 cm.
Colors: Black, Red, Yellow, Green, Blue.

Letter codes follow the rules document and CMYK printers' shorthand:
  K = blacK (-2), R = Red (-1), Y = Yellow (0), G = Green (+1), B = Blue (+2).
RGB values were chosen to match the rules figure
(rules/maze/media/cognitive_target.png) pixel-for-pixel.
"""

import os
from itertools import product
from PIL import Image, ImageDraw

# Color definitions (RGBA) — sampled from the maze rules figure.
COLORS = {
    'K': (0, 0, 0, 255),        # Black
    'R': (238, 0, 0, 255),      # Red
    'Y': (255, 255, 0, 255),    # Yellow
    'G': (0, 176, 80, 255),     # Green
    'B': (0, 176, 240, 255),    # Blue
}

# Color names for reference
COLOR_NAMES = {
    'K': 'Black',
    'R': 'Red',
    'Y': 'Yellow',
    'G': 'Green',
    'B': 'Blue',
}

# DPI for converting cm to pixels (300 DPI for high-quality print)
DPI = 300

# Ring diameters in cm (from innermost to outermost)
DIAMETERS_CM = [1, 2, 3, 4, 5]


def cm_to_pixels(cm):
    """Convert centimeters to pixels based on DPI."""
    return int(cm * DPI / 2.54)


def create_cognitive_target(color_sequence, size_pixels):
    """
    Create a cognitive target image with 5 concentric rings.
    
    Args:
        color_sequence: String of 5 color codes (e.g., 'BRYGC')
        size_pixels: Size of the output image in pixels (square)
    
    Returns:
        PIL Image with transparent background
    """
    # Use larger image for anti-aliasing, then resize down
    scale_factor = 4
    large_size = size_pixels * scale_factor
    
    # Create transparent image at larger size
    img_large = Image.new('RGBA', (large_size, large_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img_large)
    
    # Calculate center and scale
    center = large_size // 2
    max_radius = large_size // 2
    
    # Draw rings from outermost to innermost
    for ring_index in range(4, -1, -1):  # 4, 3, 2, 1, 0 (outer to inner)
        diameter_cm = DIAMETERS_CM[ring_index]
        radius = int(max_radius * (diameter_cm / 5))  # Scale to 5cm max
        
        color_code = color_sequence[ring_index]
        color = COLORS[color_code]
        
        # Draw filled circle
        bbox = [center - radius, center - radius, center + radius, center + radius]
        draw.ellipse(bbox, fill=color)
    
    # Resize down with anti-aliasing (LANCZOS)
    img = img_large.resize((size_pixels, size_pixels), Image.LANCZOS)
    
    return img


def generate_all_combinations():
    """Generate all possible color combinations for cognitive targets with exactly 5 rings."""
    color_codes = ['K', 'R', 'Y', 'G', 'B']
    
    # Generate output directory
    output_dir = 'output'
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate only 5-ring combinations
    total_generated = 0
    num_rings = 5
    
    for combination in product(color_codes, repeat=num_rings):
        color_sequence = ''.join(combination)
        
        # Generate full-size target (5cm x 5cm)
        full_size = cm_to_pixels(5)
        full_target = create_cognitive_target(color_sequence, full_size)
        full_filename = os.path.join(output_dir, f'{color_sequence}.png')
        full_target.save(full_filename)
        print(f'Generated: {full_filename}')
        total_generated += 1
    
    print(f'\nTotal images generated: {total_generated}')


if __name__ == '__main__':
    generate_all_combinations()
