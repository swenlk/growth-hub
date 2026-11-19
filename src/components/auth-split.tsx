import Image from "next/image";
import Link from "next/link";

import authImg from "@/public/assets/images/auth/auth-img.png";
import logo from "@/public/assets/images/logo.png";

export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex min-h-screen flex-wrap bg-white dark:bg-slate-900">
      <div className="hidden lg:block lg:w-1/2">
        <div className="flex h-screen flex-col items-center justify-center">
          <Image src={authImg} alt="" className="h-full w-full object-cover" priority />
        </div>
      </div>
      <div className="flex w-full flex-col justify-center px-6 py-8 lg:w-1/2">
        <div className="mx-auto w-full lg:max-w-[464px]">
          <Link href="/" className="mb-2.5 inline-block max-w-[290px]">
            <Image src={logo} alt="Training" width={168} height={40} priority />
          </Link>
          {children}
        </div>
      </div>
    </section>
  );
}
