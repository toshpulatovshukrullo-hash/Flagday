# Gol reeli: Eldor Shomurodov, 78-daqiqa (gol rekonstruksiyasi)

**Natija:** `output/gol_reel_final.mp4`: 1080×1920, 30 fps, H.264 + AAC, 15.87 s, ~32 MB, −13 LUFS.
**Sahna kliplari:** `output/scenes/` (9 ta fayl, 7-sahna ikki qismdan iborat).
**Qayta yig'ish:** `bash goal_reel/build.sh`. Kerak bo'ladi: `pip install opencv-python-headless numpy pillow scipy`, ffmpeg va manba fayl `input/videos/A_vertikal_720x1280.mp4`.

## Sahnalar va manba

Barcha kadrlar **faqat 1-videodan** (vertikal, beIN SPORTS efiri, 25 fps) olingan. 3D yoki AI kadr **yo'q**. Shuning uchun "3D animatsiya" yoki "AI yaratgan kadr" belgilari kerak bo'lmadi. "Gol rekonstruksiyasi" yozuvi butun video davomida ekranda turadi.

| № | Vaqt | Manba (1-video) | Tezlik | Kamera |
|---|---|---|---|---|
| 1 Dron | 0:00–3:00 | 6.52–9.52 s, jonli efirning yuqori keng kadri | 100% | Burilgan holatdan to'g'rilanib, o'yinchiga yaqinlashadi (dron kirishi o'rnida) |
| 2 Muzlatish | 3:00–6:00 | 721-kadr (28.84 s), orqadan kuzatuvchi kamera, zarba arafasi | 0% | Yaqinlashish, keyin uzoqlashish va ±3° og'ish (360° aylanish o'rnida) |
| 3 Makro | 6:00–8:00 | 32.20–32.40 s, yon rakurs, butsa va to'p | 10% | 1.6x dan 1.85x gacha yaqinlashish, zarba lahzasida chaqnash va silkinish |
| 4 Ramp | 8:00–9:40 | 32.40–33.17 s, to'pni kuzatuvchi kamera | 10% → 100% (silliq) | To'pni kuzatadi |
| 5 Darvoza yoni | 9:40–10:20 | 29.64–30.44 s, darvoza yonidan takror (darvozabon sakrashi) | 100% | Yengil yaqinlashish |
| 6 Chiziq oldi | 10:20–11:20 | 838-kadr (33.52 s): to'p to'sin oldida, darvozabon qo'lqopi ko'rinadi | 2% | Kichik tebranish, sovuq ton |
| 7 Gol | 11:20–12:85 | 33.52–33.97 s, pastdan to'singa qarab olingan rakurs, so'ng 30.40–30.76 s, darvoza yonida to'r silkinadi | 20% → 100%, keyin 40% | "GOL!" yozuvi to'p to'sin ostidan o'tgan lahzada chiqadi |
| 8 Yakun | 12:85–15:85 | 428–470-kadrlar, Shomurodovning yaqin plani | ~56% | Haqiqiy kadrlar, interpolyatsiyasiz (yuz buzilmasligi uchun) |

Sekin kadrlar Farneback optik oqimi bilan interpolyatsiya qilingan. Telekanal logotipi hududida oqim nolga tenglangan, shuning uchun logotip buzilmaydi. Logotip o'chirilmagan.

## Faktlar tekshiruvi
- **Gol muallifi:** formada "SHOMURODOV 14" yozuvi o'qiladi. ✔
- **Burchak:** **zarba beruvchi nuqtai nazaridan o'ng yuqori burchak** (darvozabonning chap tomoni). Asosiy kameradan to'p uzoqdagi ustunga ketadi. Darvozabon qo'lini to'sin balandligigacha cho'zadi va to'p to'sin ostidan o'tadi (33.4–33.6 s). "To'qqizlik" ✔
- **Zarba turi:** o'yin davomida berilgan zarba, jarima maydonchasi tashqarisidan. ✔
- **Masofa:** taxminan "D" yoy chizig'i atrofidan, ya'ni ~20 m. Videodan aniq o'lchab bo'lmaydi, shuning uchun 8-sahnada **"uzoq masofadan to'qqizlikka"** deb yozildi ("yigirma metrdan" o'rniga).
- **Daqiqa (78) va hisob (0:2 → 1:2, yakun 4:2):** videoda tablo yo'q, shuning uchun Championat ma'lumotiga ko'ra qoldirildi.

## Ekran matnlari (raqamlar harf bilan, xavfsiz zonada: y = 348…1476 px, chekkadan 60 px)
1. ELDOR SHOMURODOV / Bashakshehir / Chorum FK qarshi
2. yetmish sakkizinchi daqiqa / Turkiya Superligasi, oʻn ikkinchi tur
3. 7-sahna: GOL! / nol–ikkidan bir–ikkiga
4. 8-sahna: SUPERKAMBEK / ELDOR SHOMURODOV / Bashakshehir: toʻrt, Chorum FK: ikki / Shomurodovning gol zarbasi: uzoq masofadan toʻqqizlikka / Gol rekonstruksiyasi

O'zbekcha "oʻ" harfi uchun ʻ (U+02BB) belgisi ishlatildi. Shrift: Montserrat (SIL OFL litsenziyasi, `goal_reel/fonts/`).

## Ovoz
Barcha ovoz **sintez qilingan** (`goal_reel/audio.py`), tashqi namuna va musiqa yo'q, shuning uchun mualliflik huquqidan xoli. Efirning asl ovozi (sharhlovchi) ishlatilmagan.
- 1-sahna: shamol, dron shovqini, D-minor pad va ostinato, taiko zarblari.
- 2-sahna: past sub-gum va yurak urishi.
- 3-sahna: teskari "riser" va bass hit.
- 4–5-sahnalar: whoosh tovushlari va ko'tariluvchi riser.
- 6-sahna: sukunat (faqat juda past "tinnitus").
- 7–8-sahnalar: to'r tovushi, katta zarb, olomon shovqini, D-major akkord.

## Mualliflik huquqi
Video kadrlar **beIN SPORTS efiridan** olingan (logotip kadrda qolgan). Foydalanuvchi mualliflik huquqi uchun javobgarlikni o'z zimmasiga olgan. Instagramda baribir Content ID yoki shikoyat xavfi bor.

## Spetsifikatsiyadan chetlanishlar
- **360° aylanish yo'q.** Uning o'rniga foydalanuvchi ko'rsatmasiga ko'ra muzlatilgan kadrda yaqinlashish va uzoqlashish ishlatildi.
- **Dron kadri yo'q.** Efirning yuqori keng kadri dron kirishini almashtiradi.
- **Makro va "darvoza ostidan" sahnalar** haqiqiy makro emas: ular 720p manbadan raqamli yaqinlashtirilgan. Sifat manba bilan cheklangan.
- **Manba 25 fps, 720×1280.** 10% gacha sekinlashtirishda optik oqim ishlatilgan. Tez harakatda yengil "arvoh" izlar qolishi mumkin.
- **Davomiylik 15.87 s.** 5-sahna 0.8 s, 7-sahna 1.65 s: manbadagi kadrlar shu bilan cheklangan.
