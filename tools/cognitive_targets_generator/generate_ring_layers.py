#!/usr/bin/env python3
"""
Generate individual ring layer images for cognitive targets.

Each ring is generated as a separate transparent PNG image.
UI can overlay 5 ring images to create a complete cognitive target.
"""

import os
from itertools import product
from PIL import Image, ImageDraw

# Color definitions (RGBA)
COLORS = {
    'K': (0, 0, 0, 255),        # Black
    'R': (255, 0, 0, 255),      # Red
    'Y': (255, 255, 0, 255),    # Yellow
    'G': (0, 128, 0, 255),      # Green
    'B': (0, 255, 255, 255),    # Blue
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

# Canvas size for offset images (300x300 pixels)
CANVAS_SIZE = 300

# Target size for offset images (150x150 pixels approximately, ring5 = 150px)
TARGET_SIZE_OFFSET = 150


def cm_to_pixels(cm):
    """Convert centimeters to pixels based on DPI."""
    return int(cm * DPI / 2.54)


# Overlap in pixels at large scale to prevent gaps between rings
# Increased to 5 to ensure coverage even with anti-aliasing
OVERLAP = 5


def create_ring_layer(color_code, ring_index, size_pixels):
    """
    Create a single ring layer image.
    
    Args:
        color_code: Single color code (e.g., 'B', 'R', 'Y', 'G', 'C')
        ring_index: Ring index (0=innermost 1cm, 4=outermost 5cm)
        size_pixels: Size of the output image in pixels (square)
    
    Returns:
        PIL Image with transparent background, containing only the specified ring
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
    
    # Calculate outer and inner radius for this ring
    outer_diameter_cm = DIAMETERS_CM[ring_index]
    outer_radius = int(max_radius * (outer_diameter_cm / 5))
    
    if ring_index > 0:
        inner_diameter_cm = DIAMETERS_CM[ring_index - 1]
        inner_radius = int(max_radius * (inner_diameter_cm / 5)) - OVERLAP
    else:
        inner_radius = 0
    
    color = COLORS[color_code]
    
    # Draw the ring (filled circle with transparent center)
    # Draw outer circle
    outer_bbox = [center - outer_radius, center - outer_radius, 
                  center + outer_radius, center + outer_radius]
    draw.ellipse(outer_bbox, fill=color)
    
    # Cut out inner circle (make it transparent)
    if inner_radius > 0:
        inner_bbox = [center - inner_radius, center - inner_radius,
                      center + inner_radius, center + inner_radius]
        draw.ellipse(inner_bbox, fill=(0, 0, 0, 0))
    
    # Resize down with anti-aliasing (LANCZOS)
    img = img_large.resize((size_pixels, size_pixels), Image.LANCZOS)
    
    return img


def create_offset_ring_layer(color_code, ring_index, position):
    """
    Create a single ring layer image with offset positioning on a 300x300 canvas.
    
    Args:
        color_code: Single color code
        ring_index: Ring index (0-4)
        position: One of 'top', 'right', 'bottom', 'left'
    
    Returns:
        PIL Image with transparent background
    """
    # Create transparent canvas
    canvas = Image.new('RGBA', (CANVAS_SIZE, CANVAS_SIZE), (0, 0, 0, 0))
    
    # Create the ring layer image (100x100 pixels)
    ring_layer = create_ring_layer(color_code, ring_index, TARGET_SIZE_OFFSET)
    
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
    
    # Paste ring layer onto canvas
    canvas.paste(ring_layer, (x, y), ring_layer)
    
    return canvas


def generate_all_ring_layers():
    """Generate all ring layer images for all color and position combinations."""
    color_codes = ['K', 'R', 'Y', 'G', 'B']
    positions = ['top', 'right', 'bottom', 'left']
    
    # Generate output directory
    output_dir = 'output_ring_layers'
    os.makedirs(output_dir, exist_ok=True)
    
    total_generated = 0
    
    # Full-size target dimensions (5cm x 5cm at 300 DPI)
    full_size = cm_to_pixels(5)
    
    # Generate for each position
    for position in positions:
        # Generate for each ring (1-5, outer to inner)
        for ring_index in range(5):  # 0=1cm, 1=2cm, 2=3cm, 3=4cm, 4=5cm
            ring_num = ring_index + 1  # 1-5 for display
            diameter_cm = DIAMETERS_CM[ring_index]
            
            # Generate for each color
            for color_code in color_codes:
                # Create offset ring layer
                img = create_offset_ring_layer(color_code, ring_index, position)
                
                # Filename format: {position}_ring{ring_num}_{color}.png
                # e.g., top_ring1_B.png, top_ring2_R.png, etc.
                filename = os.path.join(output_dir, f'{position}_ring{ring_num}_{color_code}.png')
                img.save(filename)
                print(f'Generated: {filename}')
                total_generated += 1
    
    print(f'\nTotal images generated: {total_generated}')
    print(f'Images saved to: {output_dir}/')
    print(f'\nTo create a complete target (e.g., BRYGC), overlay in order:')
    print('  ring5 (outermost, 5cm) -> ring4 -> ring3 -> ring2 -> ring1 (innermost, 1cm)')


if __name__ == '__main__':
    generate_all_ring_layers()
