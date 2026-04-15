type Props = {
  html: string;
  className?: string;
};

export function PreviewTile({ html, className = "" }: Props) {
  return (
    <div className={`relative overflow-hidden bg-white ${className}`}>
      <iframe
        srcDoc={html}
        sandbox=""
        className="preview-iframe absolute top-0 left-0 origin-top-left"
        style={{
          width: "400%",
          height: "400%",
          transform: "scale(0.25)",
        }}
      />
    </div>
  );
}
