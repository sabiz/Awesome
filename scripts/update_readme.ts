import {
    DOMParser
} from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

type TableRow = {
  name: string;
  url: string;
  image: string;
  description: string;

}


async function createTableRow(url: string): Promise<TableRow> {
  console.log(`Creating table row for URL: ${url}`);
  
  try {
    // fetch url
    console.log("Fetching URL content...");
    const response = await fetch(url);
    
    if (response.status !== 200) {
      console.log(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      return {
        name: "Error",
        url,
        image: "",
        description: `${response.status} ${response.statusText}`
      };
    }
    
    const htmlContent = await response.text();
    console.log(`Received HTML content (${htmlContent.length} bytes)`);
    
    const DOM = new DOMParser().parseFromString(htmlContent, "text/html");
    const title = DOM.querySelector("meta[property='og:title']")?.getAttribute("content");
    const image = DOM.querySelector("meta[property='og:image']")?.getAttribute("content");
    const description = DOM.querySelector("meta[property='og:description']")?.getAttribute("content");
    
    console.log(`Extracted metadata - Title: ${title ? "Found" : "Not found"}, Image: ${image ? "Found" : "Not found"}`);
    
    return {
      name: title || "Error",
      url,
      image: image || "",
      description: description || ""
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing URL ${url}: ${errorMessage}`);
    return {
      name: "Error",
      url,
      image: "",
      description: `Error: ${errorMessage}`
    };
  }
}


async function main() {
  console.log("Starting README.md processing");
  
  const readmePath = new URL("../README.md", import.meta.url);
  console.log(`Reading file from: ${readmePath}`);
  const readme = Deno.readTextFileSync(readmePath);
  const lines = readme.split("\n");
  console.log(`Total lines in README.md: ${lines.length}`);

  const urlPatternRegex = /@@@(.+?)@@@/;
  const topListItemRegex = /^- \[([^\]]+)\]/;
  const sectionHeader2Regex = /^## (.+)/;
  const listIndentRegex = /^(\s*-\s)/;
  
  let currentTopListItem = "";
  let currentSectionHeade2 = "";
  const foundUrlPatterns: { section: string; tableRow: TableRow }[] = [];
  let inTopSection = true;

  console.log("Initialized variables for processing");
  const resultReadme: string[] = [];

  for (const line of lines) {
    if (inTopSection && line.startsWith("## ")) {
      inTopSection = false;
      console.log("Exiting top section processing");
    }
    if (inTopSection) {
      const topListItemMatch = line.match(topListItemRegex);
      if (topListItemMatch) {
        currentTopListItem = topListItemMatch[1];
        console.log(`Found top list item: ${currentTopListItem}`);
        resultReadme.push(line);
        continue;
      }

      const urlMatch = line.match(urlPatternRegex);
      if (urlMatch && currentTopListItem) {
        console.log(`Found URL pattern: ${urlMatch[0]} in section: ${currentTopListItem}`);
        const tableRow = await createTableRow(urlMatch[1]);
        console.log(`Created table row with name: ${tableRow.name}`);
        foundUrlPatterns.push({
          section: currentTopListItem,
          tableRow
        });
        const listIndentMatch = resultReadme.at(-1)?.match(listIndentRegex);
        if (listIndentMatch) {
          resultReadme.push(listIndentMatch[1] + tableRow.name);
        } else {
          resultReadme.push(`- ${tableRow.name}`);
        }
        continue;
      }
      resultReadme.push(line);
      continue;
    }

    const sectionHeader2Match = line.match(sectionHeader2Regex);
    if (sectionHeader2Match) {
      const beforeSectionHeader2 = currentSectionHeade2;
      currentSectionHeade2 = sectionHeader2Match[1];
      console.log(`Found section header: ${currentSectionHeade2}`);
      
      if (beforeSectionHeader2 !== "") {
        const matchingPatterns = foundUrlPatterns.filter((p) => p.section === beforeSectionHeader2);
        console.log(`Found ${matchingPatterns.length} URL patterns for section: ${beforeSectionHeader2}`);
        
        matchingPatterns.forEach((p) => {
          const tableRow = p.tableRow;
          console.log(`Adding table row for ${p.tableRow.name} to section ${beforeSectionHeader2}`);
          resultReadme.splice(-1, 0, `| [${tableRow.name}](${tableRow.url}) | <img width="256px" src="${tableRow.image}"> | ${tableRow.description} |`);
        });
      }
    }
    resultReadme.push(line);
  }

  console.log(`Writing ${resultReadme.length} lines back to README.md`);
  Deno.writeTextFileSync(readmePath, resultReadme.join("\n"));
  console.log("Processing complete");
}

if (import.meta.main) {
  console.log("Starting update_readme.ts script");
  try {
    await main();
    console.log("Script completed successfully");
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error executing script: ${errorMessage}`);
  }
}
