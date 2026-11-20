# QR Code

Generate, style and decode QR codes in the browser without a database or decoding backend.

[Open online](https://play.wangyifang.com/qrcode/) · [简体中文](./README.md)

## Features

- Generate URL, text and Wi-Fi QR codes; download or copy PNG and SVG to the clipboard.
- Adjust patterns, finder corners, pixel margins, gradients, opacity and logos.
- Synchronize sliders with numeric fields, including one decimal place and keyboard controls.
- Decode images selected, dropped or pasted into the page, or scan with a camera.
- Save styles in the current browser and use system, light or dark appearance.

## Usage

Requires Node.js 20 or later.

```sh
npm ci
npm run build
npm test
npm run dev
```

Open `http://127.0.0.1:4173/`. Build output is written to `dist/` and can be served from a subdirectory. Rebuild after changing source files.

## Notes

Built with React 19, HeroUI v3, Tailwind CSS 4, node-qrcode and jsQR. All visible interactive controls use HeroUI; QR styling renders a standard matrix as SVG.

Margins range from 0 to 100px, defaulting to 24px. Zero adds no hidden border. Parameter sliders range from 0 to 100 in steps of 0.1. The export-size slider maps to pixel dimensions shown in the export panel. Opacity supports numeric input. PNG and SVG preserve transparency; the preview checkerboard is excluded from exported files.

Download names use `content-YYYYMMDDHHmmss.png` (or `.svg`) in the browser's local time zone. URLs use only the hostname without `www.`, text uses its beginning, and Wi-Fi uses only the network name. URL paths, query parameters and Wi-Fi passwords are excluded. Unsafe filename characters are filtered; the content identifier is limited to 32 Unicode code points and 64 UTF-8 bytes, and the complete name to 83 bytes.

PNG copies as an image. Browsers supporting SVG image clipboard data receive both vector data and SVG source; other browsers copy the source. Pasting depends on the receiving application. Clipboards and receiving apps generally do not preserve filenames; downloads use the naming rule above. Download instead if clipboard access is denied or image copying is unsupported.

Square data modules, finder and alignment patterns use crisp edges to avoid extra gray pixels from fractional raster edges. Rounded shapes, gradients and transparency retain the smoothing they need. Scaling the page or resizing a PNG in another application can still cause interpolation.

QR content and images are processed in the current page without being uploaded. Styles, including logos and export settings, are saved in the local browser. QR content and Wi-Fi passwords are not written to storage. Clearing site data removes saved styles. If storage is unavailable, the page shows a message and editing and export remain available.

Camera and clipboard features require HTTPS or localhost and are subject to browser permissions. Camera, clipboard and decoding behavior vary by device. Large logos, low contrast and zero margins may reduce recognition by external scanners.

## License

Original code is released under the [Apache License 2.0](./LICENSE), with attribution in [NOTICE](./NOTICE). Personal branding, user-uploaded logos, images and user data are outside the code license.

Third-party dependencies retain their own licenses. See [third-party licenses](./THIRD-PARTY-LICENSES.txt) and the license comments preserved in the built JavaScript. Code licensing does not automatically cover personal branding, images or user data.
