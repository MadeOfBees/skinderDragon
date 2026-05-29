import p0 from "../assets/panorama/panorama_0.webp";
import p1 from "../assets/panorama/panorama_1.webp";
import p2 from "../assets/panorama/panorama_2.webp";
import p3 from "../assets/panorama/panorama_3.webp";

// The four horizontal cube faces, with face 0 repeated at the end so the
// horizontal pan loops seamlessly — mimicking Bedrock's rotating menu panorama.
const faces = [p0, p1, p2, p3, p0];

export function Panorama() {
  return (
    <div className="panorama" aria-hidden="true">
      <div className="panorama-strip">
        {faces.map((src, i) => (
          <img key={i} src={src} alt="" draggable={false} />
        ))}
      </div>
    </div>
  );
}
