
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyMessage } from 'ethers';
import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { address, message, signature } = await req.json();

    if (!address || !message || !signature) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Verify the signature
    try {
      const signerAddr = verifyMessage(message, signature);
      if (signerAddr.toLowerCase() !== address.toLowerCase()) {
        return NextResponse.json({ error: 'Signature verification failed' }, { status: 401 });
      }
    } catch (error) {
      console.error('Signature verification error:', error);
      return NextResponse.json({ error: 'Invalid signature format' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const lowerCaseAddress = address.toLowerCase();
    
    // 2. Find or create the user
    let userId: string;

    const { data: profile, error: profileError } = await supabase
      .from('User')
      .select('id')
      .eq('walletAddress', lowerCaseAddress)
      .single();

    if (profile) {
      userId = profile.id;
    } else if (profileError && profileError.code === 'PGRST116') { // "single()" returns no rows -> profile not found
      // Profile does not exist, so we create a new auth user and a new profile
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        user_metadata: { walletAddress: lowerCaseAddress },
      });

      if (createError || !newUser?.user) {
        console.error('Error creating user:', createError);
        return NextResponse.json({ error: `Failed to create user: ${createError?.message}` }, { status: 500 });
      }

      userId = newUser.user.id;
      // Create the corresponding profile entry
      const { error: newProfileError } = await supabase.from('User').insert({
        id: userId,
        walletAddress: lowerCaseAddress,
      });

      if (newProfileError) {
        console.error('Error creating profile:', newProfileError);
        // Clean up orphaned auth user if profile creation fails
        await supabase.auth.admin.deleteUser(userId);
        return NextResponse.json({ error: `Failed to create user profile: ${newProfileError.message}` }, { status: 500 });
      }
    } else if (profileError) {
      // A real database error occurred
      console.error('Error finding profile:', profileError);
      return NextResponse.json({ error: `Database error while fetching profile: ${profileError.message}` }, { status: 500 });
    } else {
       return NextResponse.json({ error: 'An unknown error occurred during user lookup' }, { status: 500 });
    }

    // 3. Mint a custom JWT for the user
    const jwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (!jwtSecret) {
      console.error('SUPABASE_JWT_SECRET is not set in environment variables.');
      return NextResponse.json({ error: 'Server configuration error: JWT secret is missing.' }, { status: 500 });
    }
    
    const token = jwt.sign(
      {
        aud: 'authenticated',
        exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour expiration
        sub: userId,
        user_metadata: {
          walletAddress: lowerCaseAddress,
        },
      },
      jwtSecret
    );

    return NextResponse.json({ token });

  } catch (error: any) {
    console.error('Unexpected error in /api/auth/login:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
