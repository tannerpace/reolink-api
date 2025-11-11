# NPM Publishing Guide for reolink-api

## ✅ Pre-Publication Checklist

The package is now ready for NPM publication with the following:

### Package Configuration
- ✅ **Name**: `reolink-api` (simple, descriptive)
- ✅ **Version**: `0.1.0` (semantic versioning)
- ✅ **License**: MIT
- ✅ **Repository**: GitHub (verheesj/reolink-api)
- ✅ **Author**: Jonathan Verhees
- ✅ **Keywords**: 15 relevant keywords for discoverability
- ✅ **Files**: Only dist/, README.md, LICENSE, USAGE.md published
- ✅ **Exports**: Proper ESM exports with TypeScript types
- ✅ **CLI Binary**: `reolink` command available after install

### Quality Checks
- ✅ **Build**: `npm run build:clean` removes test files
- ✅ **Types**: Full TypeScript definitions included
- ✅ **Tests**: Excluded from published package
- ✅ **Documentation**: README.md and USAGE.md included
- ✅ **License**: MIT license file present

## 📦 NPM Package Name Rules

### Name Requirements
1. **Must be unique** on NPM registry
2. **Lowercase only** (no uppercase letters)
3. **URL-safe characters** (letters, numbers, hyphens, underscores)
4. **Max 214 characters**
5. **Cannot start with dot or underscore**

### Checking Name Availability
```bash
# Check if name is available
npm view reolink-api

# If it returns "npm ERR! 404", the name is available
# If it shows package info, the name is taken
```

### Current Status
- `reolink-api` - **CHECK AVAILABILITY**
- Alternative names if taken:
  - `@verheesj/reolink-api` (scoped package - always available)
  - `reolink-client`
  - `reolink-ts`
  - `reolink-sdk`

## 🚀 Publishing Steps

### 1. Create NPM Account (if needed)
```bash
npm adduser
# OR
npm login
```

### 2. Verify Package Contents
```bash
# Dry run to see what will be published
npm pack --dry-run

# Create actual tarball to inspect
npm pack
tar -tzf reolink-api-0.1.0.tgz
```

### 3. Test Package Locally
```bash
# Install from tarball
npm install reolink-api-0.1.0.tgz

# Or use npm link
npm link
cd /some/test/project
npm link reolink-api
```

### 4. Publish to NPM
```bash
# First release (use --access public if scoped package)
npm publish

# For scoped packages (@verheesj/reolink-api)
npm publish --access public
```

### 5. Verify Publication
```bash
# Check it's live
npm view reolink-api

# Install from NPM
npm install reolink-api
```

## 📋 Version Management

### Semantic Versioning (SemVer)
- **0.1.0** - Initial release (current)
- **0.1.x** - Bug fixes
- **0.x.0** - New features (pre-1.0)
- **1.0.0** - Stable API release
- **x.0.0** - Breaking changes

### Updating Versions
```bash
# Patch release (0.1.0 -> 0.1.1)
npm version patch

# Minor release (0.1.0 -> 0.2.0)
npm version minor

# Major release (0.1.0 -> 1.0.0)
npm version major

# Then publish
npm publish
```

## 🏷️ NPM Tags

```bash
# Publish as latest (default)
npm publish

# Publish as beta
npm publish --tag beta

# Publish as next
npm publish --tag next
```

Users install with: `npm install reolink-api@beta`

## 🔒 If Name is Taken - Use Scoped Package

If `reolink-api` is unavailable, use a scoped package:

### Update package.json
```json
{
  "name": "@verheesj/reolink-api",
  ...
}
```

### Publish with public access
```bash
npm publish --access public
```

### Users install with
```bash
npm install @verheesj/reolink-api
```

### Import remains clean
```javascript
import { ReolinkClient } from "@verheesj/reolink-api";
```

## 📊 Post-Publication

### Add NPM Badge to README
```markdown
[![npm version](https://badge.fury.io/js/reolink-api.svg)](https://www.npmjs.com/package/reolink-api)
[![npm downloads](https://img.shields.io/npm/dm/reolink-api.svg)](https://www.npmjs.com/package/reolink-api)
```

### Monitor Package
- Check https://www.npmjs.com/package/reolink-api
- Monitor download stats
- Watch for issues/questions

### Update GitHub Repository
1. Add NPM package link to README
2. Create GitHub release matching NPM version
3. Tag the release: `git tag v0.1.0 && git push --tags`

## 🛠️ Maintenance Workflow

### For Each Release:
1. Update version: `npm version patch` (or minor/major)
2. Update CHANGELOG.md (if you create one)
3. Commit changes: `git commit -am "Release v0.1.x"`
4. Create git tag: `git tag v0.1.x`
5. Push with tags: `git push && git push --tags`
6. Publish to NPM: `npm publish`
7. Create GitHub release

## ⚠️ Important Notes

1. **Cannot unpublish** after 72 hours (only deprecate)
2. **Cannot reuse version numbers** - must increment
3. **Test thoroughly** before publishing
4. **Check package size** - current package is ~XXX KB unpacked
5. **Use npm pack** to preview before publishing

## 🎯 Quick Publish Command

```bash
# All-in-one publish command
npm run build:clean && npm pack --dry-run && npm publish
```

## 📞 Support

If issues arise:
- NPM Support: https://www.npmjs.com/support
- NPM Docs: https://docs.npmjs.com/
- Package unpublish policy: https://docs.npmjs.com/policies/unpublish

---

## Ready to Publish?

1. Check name availability: `npm view reolink-api`
2. Login to NPM: `npm login`
3. Verify build: `npm run build:clean`
4. Preview package: `npm pack --dry-run`
5. Publish: `npm publish`

Good luck! 🚀
