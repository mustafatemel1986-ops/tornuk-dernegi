export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <img
      className="brand-logo"
      src={`${import.meta.env.BASE_URL}logo.png`}
      alt="Törnük Derneği"
      width={size}
      height={size}
      decoding="async"
    />
  )
}
