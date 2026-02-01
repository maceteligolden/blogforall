import "reflect-metadata";
import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../src/shared/database";
import User from "../src/shared/schemas/user.schema";
import Blog from "../src/shared/schemas/blog.schema";
import Category from "../src/shared/schemas/category.schema";
import Site from "../src/shared/schemas/site.schema";
import SiteMember from "../src/shared/schemas/site-member.schema";
import { SiteMemberRole } from "../src/shared/constants";
import { logger } from "../src/shared/utils/logger";

/**
 * Migration script to migrate existing users, blogs, and categories to multi-site architecture
 * 
 * This script:
 * 1. Creates a default site for each existing user
 * 2. Migrates all blogs from user to their default site
 * 3. Migrates all categories from user to their default site
 * 4. Creates SiteMember records for users as OWNER
 */
async function migrateToMultiSite() {
  try {
    console.log("🚀 Starting migration to multi-site architecture...\n");

    // Connect to database
    await connectDatabase();
    console.log("✓ Database connected\n");

    // Get all users
    const users = await User.find({});
    console.log(`Found ${users.length} users to migrate\n`);

    let sitesCreated = 0;
    let blogsMigrated = 0;
    let categoriesMigrated = 0;
    let membersCreated = 0;
    let errors = 0;

    for (const user of users) {
      try {
        const userId = user._id!.toString();
        console.log(`Processing user: ${user.email} (${userId})`);

        // Check if user already has sites
        const existingSites = await Site.find({ owner: userId });
        
        let defaultSite;
        if (existingSites.length > 0) {
          // User already has sites, use the first one as default
          defaultSite = existingSites[0];
          console.log(`  → User already has ${existingSites.length} site(s), using first site: ${defaultSite.name}`);
        } else {
          // Create default site for user
          const siteName = `${user.first_name}'s Site`;
          const baseSlug = siteName
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "")
            .replace(/[\s_-]+/g, "-")
            .replace(/^-+|-+$/g, "");

          // Ensure unique slug
          let slug = baseSlug;
          let counter = 1;
          while (await Site.findOne({ slug })) {
            slug = `${baseSlug}-${counter}`;
            counter++;
          }

          defaultSite = new Site({
            name: siteName,
            description: "Default site",
            slug,
            owner: userId,
          });

          await defaultSite.save();
          sitesCreated++;
          console.log(`  ✓ Created default site: ${defaultSite.name} (${defaultSite.slug})`);
        }

        const siteId = defaultSite._id!.toString();

        // Check if SiteMember already exists
        const existingMember = await SiteMember.findOne({
          site_id: siteId,
          user_id: userId,
        });

        if (!existingMember) {
          // Create SiteMember record
          const siteMember = new SiteMember({
            site_id: siteId,
            user_id: userId,
            role: SiteMemberRole.OWNER,
          });
          await siteMember.save();
          membersCreated++;
          console.log(`  ✓ Created SiteMember record`);
        }

        // Migrate blogs - update site_id for blogs that don't have it or have wrong author
        const blogsToMigrate = await Blog.find({
          $or: [
            { author: userId, site_id: { $exists: false } },
            { author: userId, site_id: { $ne: siteId } },
          ],
        });

        if (blogsToMigrate.length > 0) {
          const blogIds = blogsToMigrate.map((blog) => blog._id!.toString());
          await Blog.updateMany(
            { _id: { $in: blogIds } },
            { $set: { site_id: siteId } }
          );
          blogsMigrated += blogsToMigrate.length;
          console.log(`  ✓ Migrated ${blogsToMigrate.length} blog(s)`);
        }

        // Migrate categories - migrate categories linked to user's blogs
        // Get distinct category IDs from user's blogs
        const userBlogCategories = await Blog.distinct("category", {
          author: userId,
          category: { $exists: true, $ne: null },
        });

        if (userBlogCategories.length > 0) {
          // Find categories used by user's blogs that need migration
          const categoriesToUpdate = await Category.find({
            _id: { $in: userBlogCategories },
            $or: [
              { site_id: { $exists: false } },
              { site_id: { $ne: siteId } },
            ],
          });

          if (categoriesToUpdate.length > 0) {
            await Category.updateMany(
              { _id: { $in: categoriesToUpdate.map((c) => c._id) } },
              { $set: { site_id: siteId } }
            );
            categoriesMigrated += categoriesToUpdate.length;
            console.log(`  ✓ Migrated ${categoriesToUpdate.length} categor(ies) linked to user's blogs`);
          }
        }

        // Also migrate categories that might be orphaned (no site_id)
        // These would be categories that existed before the migration
        // We'll assign them to the user's default site if they're not already assigned
        const orphanedCategories = await Category.find({
          site_id: { $exists: false },
        });

        if (orphanedCategories.length > 0) {
          // For safety, we'll only migrate orphaned categories if they're linked to user's blogs
          // or if we can determine ownership another way
          // For now, we'll skip orphaned categories to avoid data corruption
          console.log(`  ⚠ Found ${orphanedCategories.length} orphaned categor(ies) without site_id (skipped for safety)`);
        }

        console.log(`  ✓ Completed migration for user: ${user.email}\n`);
      } catch (error) {
        errors++;
        console.error(`  ✗ Error processing user ${user.email}:`, error);
        logger.error("Migration error for user", error as Error, { userId: user._id }, "Migration");
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60));
    console.log("📊 Migration Summary");
    console.log("=".repeat(60));
    console.log(`Users processed: ${users.length}`);
    console.log(`Sites created: ${sitesCreated}`);
    console.log(`Blogs migrated: ${blogsMigrated}`);
    console.log(`Categories migrated: ${categoriesMigrated}`);
    console.log(`SiteMembers created: ${membersCreated}`);
    console.log(`Errors: ${errors}`);
    console.log("=".repeat(60));

    if (errors > 0) {
      console.log("\n⚠️  Some errors occurred during migration. Please review the logs above.");
    } else {
      console.log("\n✅ Migration completed successfully!");
    }

    // Disconnect from database
    await disconnectDatabase();
    process.exit(errors > 0 ? 1 : 0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    logger.error("Migration failed", error as Error, {}, "Migration");
    await disconnectDatabase();
    process.exit(1);
  }
}

// Run migration
migrateToMultiSite();
