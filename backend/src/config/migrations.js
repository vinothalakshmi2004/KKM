import mongoose from 'mongoose';

/**
 * One-off data upgrades, safe to run on every start (each only touches documents that need it).
 */
export async function runMigrations() {
  const rooms = mongoose.connection.db.collection('rooms');

  // Rooms used to be either AC or Non-AC with one price. Now every room has both prices;
  // start both at the old price so nothing gets cheaper or dearer until it is edited.
  const { modifiedCount } = await rooms.updateMany({ acPrice: { $exists: false } }, [
    {
      $set: {
        acPrice: { $ifNull: ['$pricePerNight', 0] },
        nonAcPrice: { $ifNull: ['$pricePerNight', 0] },
      },
    },
    { $unset: ['pricePerNight', 'type'] },
  ]);
  if (modifiedCount) {
    console.log(`[migrate] ${modifiedCount} room(s) now have AC and Non-AC prices (both set to the old price; edit them on the Rooms page)`);
  }
}
