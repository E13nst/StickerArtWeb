# Тестовые видео с альфа-каналом

TODO: Добавить файлы для теста прозрачности:
- `test-hevc-alpha.mp4` — HEVC (hvc1) с альфа-каналом для Safari/iOS
- `test-alpha.webm` — WebM VP9 с альфа-каналом для Chrome/Firefox

## Процесс создания

1. Экспорт из After Effects/Premiere: ProRes 4444 с альфой
2. Конвертация в HEVC+alpha:
   ```bash
   ffmpeg -i input_prores4444.mov -c:v libx265 -preset medium -crf 18 -pix_fmt yuv420p10le -tag:v hvc1 -movflags +faststart output-hevc.mp4
   ```
   Для альфа-канала в HEVC нужна отдельная команда (зависит от входного формата).

3. Конвертация в WebM VP9:
   ```bash
   ffmpeg -i input_prores4444.mov -c:v libvpx-vp9 -pix_fmt yuva420p -auto-alt-ref 0 output-alpha.webm
   ```
