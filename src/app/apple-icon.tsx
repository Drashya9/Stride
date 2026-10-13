import { ImageResponse } from "next/og";

/** Home-screen icon (iOS needs a PNG): the same mark as icon.svg, without the rounded corners iOS adds itself. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
        }}
      >
        <svg width="132" height="132" viewBox="4 4 24 24">
          <path
            d="M21.5 10.6C20.4 9.2 18.5 8.4 16.2 8.4c-3.2 0-5.4 1.7-5.4 4.1 0 5.6 10.8 3.2 10.8 8.6 0 2.5-2.4 4.1-5.6 4.1-2.5 0-4.6-1-5.6-2.7"
            fill="none"
            stroke="#fff"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    size,
  );
}
