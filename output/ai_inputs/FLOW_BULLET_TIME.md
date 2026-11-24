# Flow: 20 soniyalik "freeze time / bullet time" (3 ta kadr)

Nega 3 ta? Flow bitta generatsiyada ~8 s beradi. Bitta uzun so'rovda Veo to'p yo'nalishini
chalkashtirib yuboradi (oldingi urinishda to'p darvozaga emas, boshqa tomonga ketgan).
Har bir kadr **haqiqiy efir kadridan** boshlanadi va yo'nalish promptda aniq yoziladi. Uchalasini men ulayman:

| # | Start frame | Davomiylik | Nima bo'ladi |
|---|---|---|---|
| A | `3_makro_zarba.jpg` | 8 s | Vaqt to'xtaydi: butsa to'pga tegib turgan lahza, kamera aylanadi, maysalar havoda |
| B | `6_tup_tusin_oldida.jpg` | 8 s | To'p to'sin oldida muzlagan, darvozabon qo'lqopi yetmaydi, kamera to'p atrofida suzadi |
| C | `5_darvozabon_ulgurmaydi.jpg` | 4–6 s | Darvozabon cho'zilgan, to'p barmoqlari yonidan to'qqizlikka kiradi, to'r silkinadi |

A va B orasiga men real (tiniqlashtirilgan) to'p uchishini qo'yaman. Jami ≈ 20 s.

Har birida: **Frames to Video**, model **Veo 3.1**, **9:16**, 2 variant. "Use AI" ni bosmang.

---

### A: zarba lahzasi (`3_makro_zarba.jpg`)
```
Create a vertical 9:16 video using the attached image as the first frame. Bullet-time freeze: time is completely stopped at the exact instant the orange boot strikes the white ball. Nothing in the scene moves except the camera. The ball stays touching the boot, slightly compressed by the impact; small blades of grass and bits of turf hang motionless in the air around the boot. A handheld macro camera slowly orbits about 180 degrees around the boot and the ball in one smooth uninterrupted move, revealing the texture of the ball, the studs of the boot and the wet grass. The shot direction does not change: the ball is being kicked toward the goal, which is off-frame to the right. Photorealistic, night stadium floodlights, shallow depth of field, crisp detail. No text, no watermark, no extra players, realistic anatomy.
```

### B: to'p to'sin oldida (`6_tup_tusin_oldida.jpg`)
```
Create a vertical 9:16 video using the attached image as the first frame. Bullet-time freeze: the white ball hangs perfectly still in mid-air just in front of the crossbar; the goalkeeper's yellow glove reaches up from below but is a few centimetres short of the ball. Everything is frozen like a diorama. The camera floats slowly around the ball from the front toward the side, keeping the ball, the crossbar and the glove in frame. In the last two seconds time slowly resumes: the ball moves past the glove, under the crossbar, into the top corner of the net. Photorealistic, night stadium floodlights, shallow depth of field. No text, no watermark, no extra players, realistic anatomy.
```

### C: darvozabon ulgurmaydi (`5_darvozabon_ulgurmaydi.jpg`)
```
Create a vertical 9:16 video using the attached image as the first frame. Super slow motion: the goalkeeper in yellow is at full stretch, diving toward the top corner; the ball flies just past his fingertips and into the top corner of the net. The net ripples and bulges outward, then time speeds up to real speed as the goalkeeper falls to the grass. The camera stays low near the post. Photorealistic, broadcast quality, night stadium floodlights. No text, no watermark, no extra players, realistic anatomy.
```

---

### Agar Flow video qabul qilsa
`flow_kirish_gol_31-34s.mp4` (tiniqlashtirilgan, 3 s: zarba → to'p uchishi → to'r) ni yuklang va:
```
Use the attached clip as the reference for the action and its direction: the player strikes the ball and it flies into the top corner of the goal. Recreate this moment as a bullet-time sequence: freeze time at the moment of the strike, let the camera orbit around the boot and the ball with grass suspended in the air, then follow the frozen ball toward the goal, past the goalkeeper's glove, and resume motion as it hits the net. Keep the same direction of the shot as in the reference. Vertical 9:16, photorealistic, night stadium floodlights. No text, no watermark.
```

**Natija:** yuklab olgan kliplarni `A.mp4`, `B.mp4`, `C.mp4` deb nomlab, shu chatga yuboring.
