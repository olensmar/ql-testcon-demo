export interface Product {
  id: string;
  name: string;
  price: number;
}

export const products: Product[] = [
  { id: "kube-mug", name: "Kube Mug", price: 12.0 },
  { id: "cluster-cap", name: "Cluster Cap", price: 18.0 },
  { id: "helm-hoodie", name: "Helm Hoodie", price: 45.0 },
  { id: "pod-stickers", name: "Pod Stickers", price: 6.0 },
];

export function findProduct(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}
