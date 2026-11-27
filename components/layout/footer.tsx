const Footer = () => {
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();

  return (
    <footer className="d-footer bg-white dark:bg-[#273142] py-6 px-[22px] mt-[auto]">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="mb-0 text-neutral-600 dark:text-white">
          &copy; {currentYear} Growth Hub. All Rights Reserved.
        </p>
        <p className="mb-0 text-neutral-600 dark:text-white">
          Made by{" "}
          <a
            href="https://jsoft.lk/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            JSOFT
          </a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
