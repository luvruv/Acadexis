import { NextResponse } from "next/server";

// An error that carries an HTTP status, so API routes can turn it into a response.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

// Converts anything thrown inside an API route into a JSON response.
export function handleApiError(error) {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error("Unexpected API error:", error);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
}