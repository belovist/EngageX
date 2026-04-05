import torch
import torch.nn as nn
import torchvision.models as models

class L2CS(nn.Module):
    def __init__(self, num_bins=90):
        super(L2CS, self).__init__()
        self.backbone = models.resnet50(weights=None)
        self.backbone.fc = nn.Identity()

        self.fc_yaw = nn.Linear(2048, num_bins)
        self.fc_pitch = nn.Linear(2048, num_bins)

    def forward(self, x):
        x = self.backbone(x)
        yaw = self.fc_yaw(x)
        pitch = self.fc_pitch(x)
        return yaw, pitch
