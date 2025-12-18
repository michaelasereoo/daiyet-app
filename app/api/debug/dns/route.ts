import { NextResponse } from "next/server";
import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);
const resolve6 = promisify(dns.resolve6);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hostname = searchParams.get('hostname') || 'jygdjpcmcfglopktusdm.supabase.co';
  
  try {
    const results: any = {
      hostname,
      timestamp: new Date().toISOString(),
    };
    
    // Test IPv4 resolution
    try {
      const ipv4 = await resolve4(hostname);
      results.ipv4 = {
        success: true,
        addresses: ipv4,
      };
    } catch (error: any) {
      results.ipv4 = {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    
    // Test IPv6 resolution
    try {
      const ipv6 = await resolve6(hostname);
      results.ipv6 = {
        success: true,
        addresses: ipv6,
      };
    } catch (error: any) {
      results.ipv6 = {
        success: false,
        error: error.message,
        code: error.code,
      };
    }
    
    // Overall status
    results.status = results.ipv4.success || results.ipv6.success ? 'OK' : 'FAILED';
    
    return NextResponse.json(results);
  } catch (error: any) {
    return NextResponse.json({
      hostname,
      status: 'ERROR',
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
