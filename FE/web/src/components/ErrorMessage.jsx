import React from "react";

export default function ErrorMessage({ message }) {
  return (
    <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100">
      <p className="text-red-500 text-lg">⚠</p>
      <p className="mt-2 text-gray-700">{message}</p>
    </div>
  );
}
