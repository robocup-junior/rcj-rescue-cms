#!/usr/bin/env python3
"""
Generate cognitive target images with concentric rings.

Each target has up to 5 concentric rings with diameters of 1, 2, 3, 4, 5 cm.
Colors: Black, Red, Yellow, Green, Cyan
"""

import os
from itertools import product
from PIL import Image, ImageDraw

# Color definitions (RGBA)
COLORS = {
    'B': (0, 0, 0, 255),        # Black
    'R': (238, 0, 0, 255),      # Red
    'Y': (255, 255, 0, 255),    # Yellow
    'G': (0, 176, 80, 255),      # Green
    'C': (0, 176, 240, 255),    # Cyan
}

# Color names for reference
COLOR_NAMES = {
    'B': 'Black',
    'R': 'Red',
    'Y': 'Yellow',
    'G': 'Green',
    'C': 'Cyan',
}

# DPI for converting cm to pixels (300 DPI for high-quality print)
DPI = 300

# Ring diameters in cm (from innermost to outermost)
DIAMETERS_CM = [1, 2, 3, 4, 5]

# Canvas size for offset images (300x300 pixels)
CANVAS_SIZE = 300

# Target size for offset images (100x100 pixels approximately)
TARGET_SIZE_OFFSET = 100


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


def create_offset_target(color_sequence, position):
    """
    Create a cognitive target image with offset positioning on a 300x300 canvas.
    
    Args:
        color_sequence: String of color codes
        position: One of 'top', 'right', 'bottom', 'left'
    
    Returns:
        PIL Image with transparent background
    """
    # Create transparent canvas
    canvas = Image.new('RGBA', (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    
    # Create the target image (100x100 pixels)
    target = create_cognitive_target(color_sequence, TARGET_SIZE_OFFSET)
    
    # Calculate position
    target_size = TARGET_SIZE_OFFSET
    canvas_center = CANVAS_SIZE // 2
    target_half = target_size // 2
    
    if position == 'top':
        x = canvas_center - target_half
        y = 0
    elif position == 'right':
        x = CANVAS_SIZE - target_size
        y = canvas_center - target_half
    elif position == 'bottom':
        x = canvas_center - target_half
        y = CANVAS_SIZE - target_size
    elif position == 'left':
        x = 0
        y = canvas_center - target_half
    else:
        raise ValueError(f"Invalid position: {position}")
    
    # Paste target onto canvas
    canvas.paste(target, (x, y), target)
    
    return canvas


def generate_all_combinations():
    """Generate all possible color combinations for cognitive targets with exactly 5 rings."""
    color_codes = ['B', 'R', 'Y', 'G', 'C']
    
    # Generate output directory
    output_dir = 'output'
    os.makedirs(output_dir, exist_ok=True)
    
    # Generate only 5-ring combinations
    total_generated = 0
    num_rings = 5
    
    for combination in product(color_codes, repeat=num_rings):
        color_sequence = ''.join(combination)
        
        # 1. Generate full-size target (5cm x 5cm)
        # 5cm at 96 DPI = ~189 pixels
        full_size = cm_to_pixels(5)
        full_target = create_cognitive_target(color_sequence, full_size)
        full_filename = os.path.join(output_dir, f'{color_sequence}.png')
        full_target.save(full_filename)
        print(f'Generated: {full_filename}')
        total_generated += 1
        
        # 2-5. Generate offset targets
        for position in ['top', 'right', 'bottom', 'left']:
            offset_target = create_offset_target(color_sequence, position)
            offset_filename = os.path.join(output_dir, f'{color_sequence}_{position}.png')
            offset_target.save(offset_filename)
            print(f'Generated: {offset_filename}')
            total_generated += 1
    
    print(f'\nTotal images generated: {total_generated}')


if __name__ == '__main__':
    generate_all_combinations()
