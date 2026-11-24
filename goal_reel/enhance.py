"""AI bilan tiniqlashtirish (super-resolution): Real-ESRGAN modellari, CPU, PyTorch.

Modellar (BSD-3, github.com/xinntao/Real-ESRGAN releases):
  general  — realesr-general-x4v3 (+ wdn varianti; shovqinni kamaytirish kuchi `denoise` bilan aralashtiriladi)
  x4plus   — RealESRGAN_x4plus (og'irroq, kuchliroq tafsilot)
Og'irliklar GOAL_REEL_MODELS papkasidan o'qiladi (torch.load(weights_only=True)).

Bu modellar kadrni kattalashtiradi va siqish artefaktlarini tozalaydi; yangi ob'ekt yoki yuz
yaratmaydi, lekin mayda teksturalarni "taxmin qiladi" (gallyutsinatsiya) — shuning uchun yuz hududi
uchun alohida, yumshoqroq aralashtirish rejimi bor.
"""
import math
import os

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

MODELS = os.environ.get("GOAL_REEL_MODELS", os.path.join(os.path.dirname(os.path.abspath(__file__)), "models"))
torch.set_num_threads(os.cpu_count() or 4)


# ----------------------------------------------------------------------------- arxitekturalar
class SRVGGNetCompact(nn.Module):
    def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4):
        super().__init__()
        self.upscale = upscale
        self.body = nn.ModuleList([nn.Conv2d(num_in_ch, num_feat, 3, 1, 1), nn.PReLU(num_parameters=num_feat)])
        for _ in range(num_conv):
            self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
            self.body.append(nn.PReLU(num_parameters=num_feat))
        self.body.append(nn.Conv2d(num_feat, num_out_ch * upscale * upscale, 3, 1, 1))
        self.upsampler = nn.PixelShuffle(upscale)

    def forward(self, x):
        out = x
        for m in self.body:
            out = m(out)
        return self.upsampler(out) + F.interpolate(x, scale_factor=self.upscale, mode="nearest")


class ResidualDenseBlock(nn.Module):
    def __init__(self, nf=64, gc=32):
        super().__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        return self.conv5(torch.cat((x, x1, x2, x3, x4), 1)) * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, nf, gc=32):
        super().__init__()
        self.rdb1, self.rdb2, self.rdb3 = ResidualDenseBlock(nf, gc), ResidualDenseBlock(nf, gc), ResidualDenseBlock(nf, gc)

    def forward(self, x):
        return self.rdb3(self.rdb2(self.rdb1(x))) * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, num_in_ch=3, num_out_ch=3, scale=4, num_feat=64, num_block=23, num_grow_ch=32):
        super().__init__()
        self.scale = scale
        in_ch = num_in_ch * (16 if scale == 1 else 4 if scale == 2 else 1)
        self.conv_first = nn.Conv2d(in_ch, num_feat, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(num_feat, num_grow_ch) for _ in range(num_block)])
        self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_last = nn.Conv2d(num_feat, num_out_ch, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(0.2, True)

    def forward(self, x):
        if self.scale == 2:
            x = F.pixel_unshuffle(x, 2)
        feat = self.conv_first(x)
        feat = feat + self.conv_body(self.body(feat))
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode="nearest")))
        feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode="nearest")))
        return self.conv_last(self.lrelu(self.conv_hr(feat)))


def _load(path):
    sd = torch.load(path, map_location="cpu", weights_only=True)
    return sd.get("params_ema", sd.get("params", sd))


def build(name="general", denoise=0.5):
    """denoise: 0 = maksimal tafsilot (wdn), 1 = maksimal shovqin tozalash (faqat general modeli)."""
    if name == "general":
        net = SRVGGNetCompact()
        a = _load(os.path.join(MODELS, "realesr-general-x4v3.pth"))
        b = _load(os.path.join(MODELS, "realesr-general-wdn-x4v3.pth"))
        net.load_state_dict({k: denoise * a[k] + (1 - denoise) * b[k] for k in a})
        scale = 4
    elif name == "x4plus":
        net = RRDBNet(scale=4)
        net.load_state_dict(_load(os.path.join(MODELS, "RealESRGAN_x4plus.pth")))
        scale = 4
    elif name == "x2plus":
        net = RRDBNet(scale=2)
        net.load_state_dict(_load(os.path.join(MODELS, "RealESRGAN_x2plus.pth")))
        scale = 2
    else:
        raise ValueError(name)
    return net.eval(), scale


@torch.inference_mode()
def upscale(net, scale, bgr, tile=320, pad=12):
    """bgr uint8 HxWx3 -> bgr uint8 (H*scale)x(W*scale)x3, bo'laklab (tile) ishlov."""
    img = torch.from_numpy(bgr[..., ::-1].astype(np.float32) / 255.0).permute(2, 0, 1)[None]
    _, _, h, w = img.shape
    out = torch.zeros(1, 3, h * scale, w * scale)
    for y0 in range(0, h, tile):
        for x0 in range(0, w, tile):
            y1, x1 = min(y0 + tile, h), min(x0 + tile, w)
            py0, px0, py1, px1 = max(y0 - pad, 0), max(x0 - pad, 0), min(y1 + pad, h), min(x1 + pad, w)
            r = net(img[:, :, py0:py1, px0:px1])
            oy, ox = (y0 - py0) * scale, (x0 - px0) * scale
            out[:, :, y0 * scale:y1 * scale, x0 * scale:x1 * scale] = \
                r[:, :, oy:oy + (y1 - y0) * scale, ox:ox + (x1 - x0) * scale]
    res = (out[0].clamp(0, 1).permute(1, 2, 0).numpy()[..., ::-1] * 255.0 + 0.5).astype(np.uint8)
    return np.ascontiguousarray(res)
