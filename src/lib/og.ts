import satori from "satori";
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const interFont = readFileSync(join(process.cwd(), "src/lib/Inter-SemiBold.ttf"));

export interface OgOptions {
  title: string;
  date?: string;
  tags?: string[];
}

export async function generateOgImage({ title, date, tags }: OgOptions): Promise<Buffer> {
  // Build horizontal grid lines
  const gridLines = Array.from({ length: 8 }, (_, i) => ({
    type: "div" as const,
    props: {
      style: {
        position: "absolute" as const,
        left: "0",
        right: "0",
        top: `${80 * (i + 1)}px`,
        height: "1px",
        background: `linear-gradient(90deg, transparent 0%, rgba(41,182,246,0.03) 20%, rgba(139,92,246,0.03) 80%, transparent 100%)`,
      },
    },
  }));

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(145deg, #080c12 0%, #0f1520 50%, #080c12 100%)",
          fontFamily: "Inter",
        },
        children: [
          // Gradient border frame
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                top: "0",
                left: "0",
                right: "0",
                bottom: "0",
                border: "1px solid transparent",
                borderImage: "linear-gradient(145deg, rgba(41,182,246,0.3), rgba(139,92,246,0.15), rgba(41,182,246,0.1)) 1",
              },
            },
          },
          // Background glow — top-right (bigger, brighter)
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                top: "-200px",
                right: "-150px",
                width: "600px",
                height: "600px",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(41,182,246,0.12) 0%, rgba(139,92,246,0.06) 40%, transparent 70%)",
              },
            },
          },
          // Background glow — bottom-left (violet)
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                bottom: "-150px",
                left: "-100px",
                width: "450px",
                height: "450px",
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(139,92,246,0.1) 0%, rgba(41,182,246,0.03) 50%, transparent 70%)",
              },
            },
          },
          // Center glow (subtle)
          {
            type: "div",
            props: {
              style: {
                position: "absolute",
                top: "150px",
                left: "300px",
                width: "500px",
                height: "300px",
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse, rgba(41,182,246,0.04) 0%, transparent 70%)",
              },
            },
          },
          // Horizontal grid lines
          ...gridLines,
          // Content container
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                padding: "60px 70px",
                width: "100%",
                height: "100%",
                position: "relative",
              },
              children: [
                // Top: rebjak.com branding
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    },
                    children: [
                      {
                        type: "div",
                        props: {
                          style: {
                            width: "10px",
                            height: "10px",
                            borderRadius: "50%",
                            background: "#29b6f6",
                            boxShadow:
                              "0 0 12px rgba(41,182,246,0.7), 0 0 40px rgba(41,182,246,0.3)",
                          },
                        },
                      },
                      {
                        type: "span",
                        props: {
                          style: {
                            fontSize: "24px",
                            color: "#71717a",
                            letterSpacing: "-0.02em",
                          },
                          children: "rebjak.com",
                        },
                      },
                    ],
                  },
                },
                // Center: title + accent line
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: "24px",
                      flex: "1",
                      justifyContent: "center",
                    },
                    children: [
                      {
                        type: "h1",
                        props: {
                          style: {
                            fontSize: title.length > 60 ? "42px" : "52px",
                            fontWeight: 600,
                            color: "#fafafa",
                            lineHeight: 1.2,
                            letterSpacing: "-0.03em",
                            margin: 0,
                          },
                          children: title,
                        },
                      },
                      // Gradient accent line
                      {
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            alignItems: "center",
                            gap: "0",
                          },
                          children: [
                            {
                              type: "div",
                              props: {
                                style: {
                                  width: "140px",
                                  height: "3px",
                                  borderRadius: "2px",
                                  background:
                                    "linear-gradient(90deg, #29b6f6, #8b5cf6)",
                                },
                              },
                            },
                            {
                              type: "div",
                              props: {
                                style: {
                                  width: "60px",
                                  height: "1px",
                                  background:
                                    "linear-gradient(90deg, rgba(139,92,246,0.4), transparent)",
                                },
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                },
                // Bottom: date + tags
                {
                  type: "div",
                  props: {
                    style: {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    },
                    children: [
                      date
                        ? {
                            type: "span",
                            props: {
                              style: {
                                fontSize: "20px",
                                color: "#71717a",
                              },
                              children: date,
                            },
                          }
                        : { type: "span", props: { children: "" } },
                      tags && tags.length > 0
                        ? {
                            type: "div",
                            props: {
                              style: {
                                display: "flex",
                                gap: "8px",
                              },
                              children: tags.slice(0, 3).map((tag) => ({
                                type: "span",
                                props: {
                                  style: {
                                    fontSize: "16px",
                                    color: "#29b6f6",
                                    border: "1px solid rgba(41,182,246,0.3)",
                                    borderRadius: "9999px",
                                    padding: "4px 14px",
                                    background: "rgba(41,182,246,0.05)",
                                  },
                                  children: `#${tag}`,
                                },
                              })),
                            },
                          }
                        : { type: "span", props: { children: "" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Inter",
          data: interFont,
          weight: 600,
          style: "normal",
        },
      ],
    },
  );

  return sharp(Buffer.from(svg)).png().toBuffer();
}
