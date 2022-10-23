# 🚧 NEOS Fusion & AFX 🚧

This package is **WIP**

<p align="center">
  <img src="https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/goto_definition.gif?raw=true" alt="animated" />
</p>

<p align="center">
  <img src="https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/goto_eel_helper_method.gif?raw=true" alt="animated" />
</p>


## Functionality

### [Goto Definition](https://code.visualstudio.com/docs/editor/editingevolved#_go-to-definition) (*CMD + Click*)

Currently works on **Prototypes** and fusion **Properties** (detected by `this` or `props`)

Support for EEL-Helper is present, but currently not for functions (like `q(node)`). 

#### Find References (*Shift + CMD + Click*)

Currently works on **Prototypes** only.

Support for EEL as well as Fusion-Properties will be added in the future.

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/goto_reference.png?raw=true)

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/goto_reference_all.png?raw=true)

#### Hover

Currently works on **Prototypes** and **Properties** only and just shows the name and sometimes the value of the property. Will provide more information from the yaml-configuration in the future.

Support for EEL-Helper ist present but the description parsing is not working a 100% correct.  

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/hover_props_value_prototype.png?raw=true)

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/hover_props_value_string.png?raw=true)

![goto image](https://github.com/sjsone/vscode-neos-fusion-lsp/blob/main/images/hover_eel_helper_method.png?raw=true)

#### Autocompletion

Currently works on **Prototype-Names** and **Fusion-Properties** only and it does autocomplete them on every point inside the fusion-file. Which is better than typing it by hand but still far from perfect.

Real support (not just string comparison) will be added in the *not so far but still far* future.

## FAQ

#### How does it work?

The language-server relies heavely on the [ts-fusion-parser](https://www.npmjs.com/package/ts-fusion-parser) which is a typescript  port of the "official" [Fusion Parser](https://github.com/neos/neos-development-collection/tree/8.2/Neos.Fusion/Classes/Core).

Essentialy it reads all AST-Nodes from the fusion parser and checks if the curser is on one of these AST-Nodes. If it is, the relevant actions are carried out.

The AFX and EEL parser is part of the [ts-fusion-parser](https://www.npmjs.com/package/ts-fusion-parser). 

#### Is there a roadmap?

Currently there is no roadmap.  

#### What about EEL-Helper and NodeType-Configuration

There is rudimentary support for EEL-Helper. Hover and Goto-Definition is currently (somewhat) supported.

## Known Bugs

- EEL-Helper hover description will parse the first description it can find which may not be the correct one
- EEL-Helper with the same name may be handled incorrectly
- Autocompletion is just a list with no semantic meaning 
