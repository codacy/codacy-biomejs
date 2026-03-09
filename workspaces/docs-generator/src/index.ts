import { DocsGenerator } from "docs-generator/src/docsGenerator.ts"

async function main() {
  try {
    const docGenerator = new DocsGenerator()

    await docGenerator.createDescriptionFile()
    await docGenerator.createPatternsFile()
    await docGenerator.createAllPatternsMultipleTestFiles()
    await docGenerator.downloadRuleDocs()

  } catch (error) {
    console.error(error)
  }
}

main()
