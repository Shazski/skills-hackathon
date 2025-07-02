import LOGO from '../../assets/logo.jpg';

export const Home = () => {
  return (
    <div className="px-4 md:px-12">
      <h1 className="text-3xl font-bold mb-4 text-left">Your Homes</h1>

      <div className="flex flex-wrap justify-center md:justify-evenly gap-6">
        <img src={LOGO} alt="Logo 1" className="h-60 w-full md:w-[22%] rounded-xl" />
        <img src={LOGO} alt="Logo 2" className="h-60 w-full md:w-[22%] rounded-xl" />
        <img src={LOGO} alt="Logo 3" className="h-60 w-full md:w-[22%] rounded-xl" />
        <img src={LOGO} alt="Logo 4" className="h-60 w-full md:w-[22%] rounded-xl" />
        <img src={LOGO} alt="Logo 5" className="h-60 w-full md:w-[22%] rounded-xl" />
        <img src={LOGO} alt="Logo 6" className="h-60 w-full md:w-[22%] rounded-xl" />
        <img src={LOGO} alt="Logo 7" className="h-60 w-full md:w-[22%] rounded-xl" />
        <img src={LOGO} alt="Logo 8" className="h-60 w-full md:w-[22%] rounded-xl" />
      </div>
    </div>
  );
};
