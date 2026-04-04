package com.engagex.attention

class AttentionFusion {
    private var smoothed: Float? = null
    private val alpha = 0.3f

    fun fuse(headPoseScore: Float?, gazeScore: Float?, microexpScore: Float?): Float {
        val values = listOfNotNull(headPoseScore, gazeScore, microexpScore)
        val base = if (values.isEmpty()) 0f else values.sum() / values.size

        smoothed = if (smoothed == null) {
            base
        } else {
            alpha * base + (1f - alpha) * smoothed!!
        }

        return smoothed!!
    }
}
