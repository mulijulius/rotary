const WHATSAPP_NUMBER = "254703437944"; // 0703437944 in international format (Kenya, no leading 0)

const WHATSAPP_MESSAGE =
  "Hello Rotary Club of Athi River! I'd like to learn more about your community service projects (water & sanitation, education, health, and economic development) and how I can get involved or support your work.";

const WHATSAPP_HREF = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;

export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_HREF}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-6 left-6 z-50 flex size-14 animate-bounce items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 hover:animate-none focus-visible:animate-none focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-[#25D366]/40"
    >
      <span className="sr-only">Chat with us on WhatsApp</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 32 32"
        className="size-7 fill-current"
      >
        <path d="M16.004 0C7.164 0 0 7.163 0 16c0 2.822.744 5.556 2.157 7.964L0 32l8.24-2.13A15.93 15.93 0 0 0 16.004 32C24.84 32 32 24.837 32 16S24.84 0 16.004 0Zm0 29.27c-2.53 0-5.005-.68-7.163-1.966l-.514-.305-4.89 1.264 1.307-4.76-.335-.49A13.24 13.24 0 0 1 2.73 16c0-7.32 5.954-13.27 13.274-13.27S29.276 8.68 29.276 16 23.324 29.27 16.004 29.27Zm7.29-9.95c-.4-.2-2.363-1.166-2.73-1.3-.366-.134-.632-.2-.898.2-.266.4-1.032 1.3-1.265 1.566-.233.267-.465.3-.865.1-.4-.2-1.688-.622-3.216-1.98-1.19-1.06-1.993-2.37-2.226-2.77-.233-.4-.025-.616.175-.816.18-.18.4-.465.6-.698.2-.233.266-.4.4-.665.133-.267.066-.5-.033-.7-.1-.2-.898-2.163-1.23-2.964-.324-.78-.653-.675-.898-.687l-.765-.014c-.266 0-.698.1-1.064.5-.365.4-1.396 1.365-1.396 3.33 0 1.965 1.43 3.865 1.63 4.132.2.266 2.813 4.296 6.82 6.024.953.412 1.696.658 2.276.842.956.304 1.827.261 2.516.158.767-.114 2.363-.966 2.696-1.898.333-.933.333-1.732.233-1.898-.1-.167-.366-.267-.766-.467Z" />
      </svg>
    </a>
  );
}
