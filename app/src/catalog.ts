export interface Product {
  id: string;
  name: string;
  price: number;
  /** Image URL, or an emoji shown in its place. */
  image: string;
}

export const products: Product[] = [
  { id: "gopher", name: "Gopher Plushie", price: 12.0, image: "🐹" },
  { id: "octopus", name: "Octopus Plushie", price: 18.0, image: "🐙" },
  { id: "teddy-bear", name: "Giant Teddy Bear", price: 45.0, image: "🧸" },
  { id: "mini-penguin", name: "Mini Penguin", price: 6.0, image: "🐧" },
  { id: "testkube-plushie", name: "Testkube Plushie", price: 24.0, image: "/testkube-plushie.svg" },
];

export function findProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
