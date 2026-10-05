import { describe, expect, it } from "vitest";
import { optimizedImage, optimizedSrcSet } from "./image";

const CLOUDINARY = "https://res.cloudinary.com/demo/image/upload/v1/velvet-noise/gorro.jpg";

describe("optimizedImage", () => {
  it("agrega formato, calidad y ancho a una URL de Cloudinary", () => {
    expect(optimizedImage(CLOUDINARY, 600)).toBe(
      "https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_limit,w_600/v1/velvet-noise/gorro.jpg"
    );
  });

  it("deja igual las imágenes locales", () => {
    expect(optimizedImage("/products/jogger.jpg", 600)).toBe("/products/jogger.jpg");
    expect(optimizedSrcSet("/products/jogger.jpg", [400, 800])).toBeUndefined();
  });

  it("arma un srcSet con cada ancho", () => {
    expect(optimizedSrcSet(CLOUDINARY, [400, 800])).toContain("w_800/v1/velvet-noise/gorro.jpg 800w");
  });
});
