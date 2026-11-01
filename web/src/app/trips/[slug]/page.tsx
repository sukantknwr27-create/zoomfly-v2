import type { Metadata } from 'next'
import { TripDetail, detailMetadata } from '@/components/TripDetail'

export const dynamic = 'force-dynamic'
export const generateMetadata = ({ params }: { params: { slug: string } }): Promise<Metadata> => detailMetadata(params.slug)
export default function TripPage({ params }: { params: { slug: string } }) {
  return <TripDetail slug={params.slug} route="trips" />
}
