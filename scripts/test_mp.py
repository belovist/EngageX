"""
Test MediaPipe installation and import paths.
Run this first to verify MediaPipe is working correctly.
"""

import mediapipe as mp

print(f"MediaPipe version: {mp.__version__}")
print(f"Has 'solutions' attribute: {hasattr(mp, 'solutions')}")

if hasattr(mp, 'solutions'):
    print(f"Face Mesh available: {hasattr(mp.solutions, 'face_mesh')}")
    if hasattr(mp.solutions, 'face_mesh'):
        print("SUCCESS: MediaPipe Face Mesh import successful!")
        print(f"FaceMesh class: {mp.solutions.face_mesh.FaceMesh}")
    else:
        print("ERROR: Face Mesh not found in solutions")
else:
    print("ERROR: 'solutions' module not found")
    print("Available attributes:", [attr for attr in dir(mp) if not attr.startswith('_')])
    
    # Try to access solutions directly
    try:
        from mediapipe import solutions
        print("SUCCESS: Can import solutions directly via 'from mediapipe import solutions'")
        print(f"Solutions module: {solutions}")
        if hasattr(solutions, 'face_mesh'):
            print("SUCCESS: Face Mesh found in direct import!")
    except ImportError as e:
        print(f"ERROR: Cannot import solutions directly: {e}")
