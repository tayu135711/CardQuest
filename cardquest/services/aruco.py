from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional

import numpy as np

try:
    import cv2
except Exception:  # pragma: no cover - optional dependency
    cv2 = None


@dataclass(slots=True)
class MarkerDetection:
    marker_id: int
    corners: List[List[float]]


def aruco_available() -> bool:
    return bool(cv2 and hasattr(cv2, "aruco"))


def detect_markers(frame_bgr: np.ndarray) -> List[MarkerDetection]:
    if not aruco_available():
        return []

    dictionary = cv2.aruco.getPredefinedDictionary(cv2.aruco.DICT_4X4_50)
    if hasattr(cv2.aruco, "DetectorParameters"):
        parameters = cv2.aruco.DetectorParameters()
    else:  # pragma: no cover - compatibility path
        parameters = cv2.aruco.DetectorParameters_create()

    if hasattr(cv2.aruco, "ArucoDetector"):
        detector = cv2.aruco.ArucoDetector(dictionary, parameters)
        corners, ids, _rejected = detector.detectMarkers(frame_bgr)
    else:  # pragma: no cover - compatibility path
        corners, ids, _rejected = cv2.aruco.detectMarkers(frame_bgr, dictionary, parameters=parameters)

    detections: List[MarkerDetection] = []
    if ids is None:
        return detections

    for index, marker_id in enumerate(ids.flatten().tolist()):
        marker_corners = corners[index].reshape(-1, 2).tolist()
        detections.append(MarkerDetection(marker_id=marker_id, corners=marker_corners))
    return detections


def texture_to_bgr(texture) -> Optional[np.ndarray]:
    if texture is None:
        return None

    width, height = texture.size
    if width == 0 or height == 0:
        return None

    pixels = np.frombuffer(texture.pixels, dtype=np.uint8)
    if pixels.size != width * height * 4:
        return None

    rgba = pixels.reshape(height, width, 4)
    return cv2.cvtColor(rgba, cv2.COLOR_RGBA2BGR) if cv2 else None
