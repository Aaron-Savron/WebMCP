import { NextResponse } from 'next/server';
import { PRODUCTS } from '../../../lib/products';

export async function GET() {
  return NextResponse.json({
    products: PRODUCTS.map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      category: p.category,
      inStock: p.inStock,
    })),
    count: PRODUCTS.length,
  });
}
