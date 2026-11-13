import Image from 'next/image';
import { Eyebrow } from './about';
import { CROPS } from './content';

export function SupportedCrops() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4">
          <Eyebrow>Supported crops</Eyebrow>
          <h2 data-reveal className="text-3xl font-semibold tracking-[-0.03em] sm:text-[2.6rem]">
            For Every Crop, Every Farmer
          </h2>
          <p data-reveal className="text-sm text-muted-foreground sm:text-base">
            From cereals to cash crops — 59 crops grown across India, including these favourites.
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
          {CROPS.map((crop, index) => (
            <li
              key={crop.name}
              data-crop-tile
              className={`group relative aspect-[4/3] overflow-hidden rounded-2xl shadow-sm ring-1 ring-black/5 ${index === 4 ? 'col-span-2 aspect-[8/3] sm:col-span-1 sm:aspect-[4/3]' : ''}`}
            >
              <Image
                src={crop.image}
                alt={crop.alt}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw"
                className="object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/5 to-transparent transition-opacity duration-500 group-hover:opacity-80" />
              <span className="absolute bottom-3 left-4 text-base font-semibold text-white drop-shadow-sm">{crop.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
