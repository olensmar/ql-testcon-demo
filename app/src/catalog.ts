export interface Product {
  id: string;
  name: string;
  price: number;
}

export const products: Product[] = [
  { id: "gopher", name: "Gopher Plushie", price: 12.0 },
  { id: "octopus", name: "Octopus Plushie", price: 18.0 },
  { id: "teddy-bear", name: "Giant Teddy Bear", price: 45.0 },
  { id: "mini-penguin", name: "Mini Penguin", price: 6.0 },
];

export function findProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
