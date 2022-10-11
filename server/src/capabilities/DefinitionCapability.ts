import { DefinitionLink, DefinitionParams } from 'vscode-languageserver/node';
import { getPrototypeNameFromNode } from '../util';
import { AbstractCapability } from './AbstractCapability';

export class DefinitionCapability extends AbstractCapability {

	public run(params: DefinitionParams) {
		const line = params.position.line + 1
		const column = params.position.character + 1
		this.log(`${line}/${column} ${params.textDocument.uri} ${params.workDoneToken}`);

		const workspace = this.languageServer.getWorspaceFromFileUri(params.textDocument.uri)
		if (workspace === undefined) return null

		const parsedFile = workspace.getParsedFileByUri(params.textDocument.uri)
		if (parsedFile === undefined) return null

		const foundNodeByLine = parsedFile.getNodeByLineAndColumn(line, column)
		if (foundNodeByLine === undefined) return null

		const foundNodeByLineBegin = foundNodeByLine.getBegin()
		const foundNodeByLineEnd = foundNodeByLine.getEnd()

		this.log(`node type "${foundNodeByLine.getNode().constructor.name}"`)

		const goToPrototypeName = getPrototypeNameFromNode(foundNodeByLine.getNode())
		if (goToPrototypeName === "") return null

		this.log(`goToPrototypeName "${goToPrototypeName}"`)
		const locations: DefinitionLink[] = []

		for (const otherParsedFile of workspace.parsedFiles) {
			for (const otherNode of [...otherParsedFile.prototypeCreations, ...otherParsedFile.prototypeOverwrites]) {
				if (otherNode.getNode()["identifier"] !== goToPrototypeName) continue
				const otherNodeBegin = otherNode.getBegin()
				const otherNodeEnd = otherNode.getEnd()

				const targetRange = {
					start: { line: otherNodeBegin.line - 1, character: otherNodeBegin.column - 1 },
					end: { line: otherNodeEnd.line - 1, character: otherNodeEnd.column - 1 }
				}

				locations.push({
					targetUri: otherParsedFile.uri,
					targetRange,
					targetSelectionRange: targetRange,
					originSelectionRange: {
						start: { line: foundNodeByLineBegin.line - 1, character: foundNodeByLineBegin.column - 1 },
						end: { line: foundNodeByLineEnd.line - 1, character: foundNodeByLineEnd.column - 1 }
					}
				})
			}
		}

		return locations
	}
}