import { Button } from '@/components/ui/button';
import LOGO from '../../assets/logo.jpg';
import { CreateHomeModal } from './_components/modal';

export const Home = () => {
  return (
    <div className="px-4 md:px-12">
      <h1 className="text-3xl font-bold text-center w-full dark:text-white">🏠 Your Homes</h1>
      <div className="flex justify-end mb-6 me-14 mt-2">
        <CreateHomeModal />
      </div>
      <div className="flex flex-wrap justify-center md:justify-evenly gap-6 mt-4">
        {[1, 2, 3, 4].map((_, i) => (
          <div
            key={i}
            className="border rounded-2xl w-[270px] overflow-hidden bg-white dark:bg-muted shadow-sm hover:shadow-lg transition-shadow duration-300 group"
          >
            <div className="overflow-hidden">
              <img
                src={LOGO}
                alt={`Logo ${i + 1}`}
                className="h-60 w-full cursor-pointer object-cover transition-transform duration-500 ease-in-out group-hover:scale-105"
              />
            </div>

            <div className="p-3">
              <h6 className="text-sm font-medium text-gray-700 dark:text-white mb-1">📍 Address Name</h6>
              <h6 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Luxury Home {i + 1}</h6>

              <div className="flex flex-wrap gap-2">
                <Button className="rounded-sm" size="sm" variant="destructive">
                  Compare
                </Button>
                <Button className="rounded-sm" size="sm" variant="default">
                  Edit
                </Button>
                {i === 3 && (
                  <Button className="rounded-sm" size="sm" variant="success">
                    Completed
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
